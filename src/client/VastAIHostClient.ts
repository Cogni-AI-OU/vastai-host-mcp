import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import axios, { AxiosError, type AxiosInstance } from 'axios';
import type pino from 'pino';

import type { AppConfig } from '../config.js';

type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface CliCommandResult {
  args: string[];
  command: string;
  stderr: string;
  stdout: string;
}

export interface SetDefaultJobInput {
  args?: string | undefined;
  env?: Record<string, string> | undefined;
  image?: string | undefined;
  machine_id: number;
  onstart_cmd?: string | undefined;
  price_gpu?: number | undefined;
}

export interface UpsertOfferInput {
  disk_space?: number | undefined;
  machine_id: number;
  max_bid?: number | undefined;
  min_bid?: number | undefined;
  offer_id?: number | undefined;
}

export class VastAIHostClient {
  private static instance: VastAIHostClient | null = null;

  private readonly config: AppConfig;
  private readonly execFileAsync = promisify(execFile);
  private readonly httpClient: AxiosInstance;
  private readonly logger: pino.Logger;

  private constructor(config: AppConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.httpClient = axios.create({
      baseURL: config.vastServerUrl,
      headers: {
        Authorization: `Bearer ${config.vastApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: config.vastRequestTimeoutMs
    });
  }

  public static getInstance(config: AppConfig, logger: pino.Logger): VastAIHostClient {
    if (VastAIHostClient.instance === null) {
      VastAIHostClient.instance = new VastAIHostClient(config, logger);
    }

    return VastAIHostClient.instance;
  }

  public async getHostLogs(machineId: number, lines = 200): Promise<unknown> {
    // Host logs are typically only available through CLI, not API
    throw new Error(
      `Host logs for machine ${machineId} are only available through Vast.ai CLI. ` +
      `Use: vastai show machine ${machineId} or check system logs directly on the host.`
    );
  }

  public async getHostStats(): Promise<unknown> {
    // Aggregate stats from machines endpoint since /hosts/stats doesn't exist
    const machines = await this.showMachines() as { machines: any[] };

    if (!machines.machines || !Array.isArray(machines.machines)) {
      throw new Error('Unable to retrieve machine data for stats calculation');
    }

    const stats = {
      total_machines: machines.machines.length,
      listed_machines: machines.machines.filter(m => m.listed).length,
      unlisted_machines: machines.machines.filter(m => !m.listed).length,
      verified_machines: machines.machines.filter(m => m.verification === 'verified').length,
      total_earnings_hour: machines.machines.reduce((sum, m) => sum + (m.earn_hour || 0), 0),
      total_earnings_day: machines.machines.reduce((sum, m) => sum + (m.earn_day || 0), 0),
      active_rentals: machines.machines.reduce((sum, m) => sum + (m.current_rentals_running || 0), 0),
      total_gpus: machines.machines.reduce((sum, m) => sum + (m.num_gpus || 0), 0),
      average_reliability: machines.machines.length > 0
        ? machines.machines.reduce((sum, m) => sum + (m.reliability2 || 0), 0) / machines.machines.length
        : 0
    };

    return stats;
  }

  public async getNetworkStatus(machineId: number): Promise<unknown> {
    // Get network status from machine details since /machines/{id}/network doesn't exist
    const machine = await this.showMachines(machineId) as any;

    if (!machine || typeof machine !== 'object') {
      throw new Error(`Unable to retrieve machine ${machineId} for network status`);
    }

    // Check if we have network fields, if not, get from full machine list
    let networkInfo: any = {};

    if (machine.public_ipaddr || machine.inet_up || machine.inet_down) {
      // Single machine endpoint has network data
      networkInfo = {
        machine_id: machine.id || machine.machine_id || machineId,
        public_ipaddr: machine.public_ipaddr,
        inet_up: machine.inet_up,
        inet_down: machine.inet_down,
        direct_port_count: machine.direct_port_count,
        geolocation: machine.geolocation,
        bw_nvlink: machine.bw_nvlink,
        pcie_bw: machine.pcie_bw,
        pci_gen: machine.pci_gen,
        disk_bw: machine.disk_bw
      };
    } else {
      // Try to get network data from full machine list
      const allMachines = await this.showMachines() as { machines: any[] };
      const targetMachine = allMachines.machines?.find(m => (m.id || m.machine_id) === machineId);

      if (targetMachine) {
        networkInfo = {
          machine_id: targetMachine.id || targetMachine.machine_id || machineId,
          public_ipaddr: targetMachine.public_ipaddr,
          inet_up: targetMachine.inet_up,
          inet_down: targetMachine.inet_down,
          direct_port_count: targetMachine.direct_port_count,
          geolocation: targetMachine.geolocation,
          bw_nvlink: targetMachine.bw_nvlink,
          pcie_bw: targetMachine.pcie_bw,
          pci_gen: targetMachine.pci_gen,
          disk_bw: targetMachine.disk_bw
        };
      } else {
        throw new Error(`Machine ${machineId} not found in machine list for network status`);
      }
    }

    return networkInfo;
  }

  public async getVerificationStatus(machineId?: number): Promise<unknown> {
    const response = (await this.showMachines()) as { machines?: Array<Record<string, unknown>> };
    const machines = response.machines ?? [];

    if (machineId !== undefined) {
      const machine = machines.find((candidate) => {
        const id = Number(candidate.id ?? candidate.machine_id);
        return id === machineId;
      });

      if (machine === undefined) {
        throw new Error(`Machine ${machineId} was not found in host machine inventory.`);
      }

      return {
        machine_id: machineId,
        reliability2: machine.reliability2 ?? null,
        verification: machine.verification ?? 'unknown',
        vm_error_level: machine.vm_error_level ?? null,
        vm_error_msg: machine.vm_error_msg ?? null
      };
    }

    const verified = machines.filter((machine) => machine.verification === 'verified').length;

    return {
      summary: {
        total_machines: machines.length,
        unverified_machines: machines.length - verified,
        verified_machines: verified
      },
      verification_statuses: machines.map((machine) => ({
        machine_id: machine.id ?? machine.machine_id,
        reliability2: machine.reliability2 ?? null,
        verification: machine.verification ?? 'unknown'
      }))
    };
  }

  public async makeRequest<T>(
    method: HttpMethod,
    endpoint: string,
    queryParams?: Record<string, unknown>,
    body?: unknown
  ): Promise<T> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    this.logger.debug(
      {
        endpoint: normalizedEndpoint,
        hasBody: body !== undefined,
        method,
        queryParams
      },
      'Calling Vast.ai host API endpoint'
    );

    try {
      const response = await this.httpClient.request<T>({
        data: body,
        method,
        params: queryParams,
        url: normalizedEndpoint
      });

      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const status = err.response?.status;
      const responseData = this.safelySerialize(err.response?.data);

      this.logger.error(
        {
          endpoint: normalizedEndpoint,
          error: err.message,
          method,
          responseData,
          status
        },
        'Vast.ai API request failed'
      );

      throw new Error(
        `Vast.ai API request failed (${method} ${normalizedEndpoint}). ` +
          `Status: ${status ?? 'unknown'}. ` +
          `Details: ${responseData ?? 'No error payload returned.'}`
      );
    }
  }

  public async restartDaemon(machineId: number, component?: string): Promise<unknown> {
    throw new Error(
      `Daemon restart is not currently exposed as a public Vast API endpoint. ` +
      `Use Vast CLI on host directly (component=${component ?? 'default'}) for machine ${machineId}.`
    );
  }

  public async runCliCommand(args: string[]): Promise<CliCommandResult> {
    if (!this.config.vastUseCliFallback) {
      throw new Error(
        'CLI fallback is disabled. Set VAST_USE_CLI_FALLBACK=true to enable host CLI execution.'
      );
    }

    this.logger.info({ command: this.config.vastCliPath, args }, 'Running Vast.ai CLI fallback command');

    try {
      const { stderr, stdout } = await this.execFileAsync(this.config.vastCliPath, args, {
        encoding: 'utf8',
        timeout: this.config.vastRequestTimeoutMs
      });

      return {
        args,
        command: this.config.vastCliPath,
        stderr,
        stdout
      };
    } catch (error) {
      const err = error as Error & { stderr?: string; stdout?: string };
      const details = [err.message, err.stderr, err.stdout].filter(Boolean).join(' | ');
      throw new Error(`Vast.ai CLI command failed: ${details}`);
    }
  }

  public async runSelfTest(machineId: number, quick = false): Promise<unknown> {
    throw new Error(
      `Machine self-test is not currently documented as a direct Vast API endpoint. ` +
      `Use Vast CLI: vastai self-test machine ${machineId}${quick ? ' --quick' : ''}.`
    );
  }

  public async searchOffers(query: Record<string, unknown>): Promise<unknown> {
    const payload = {
      ...query
    };

    return this.makeRequest('POST', '/bundles/', undefined, payload);
  }

  public async setDefaultJob(input: SetDefaultJobInput): Promise<unknown> {
    if (!input.image) {
      throw new Error('set defjob requires an image value (e.g. nvidia/cuda:12.4.1-runtime-ubuntu22.04).');
    }

    const machineResponse =
      (await this.showMachines(input.machine_id)) as Record<string, unknown> | Array<Record<string, unknown>>;
    const normalizedMachine = Array.isArray(machineResponse) ? machineResponse[0] : machineResponse;

    if (normalizedMachine === undefined || normalizedMachine === null) {
      throw new Error(`Machine ${input.machine_id} was not found for set defjob.`);
    }

    const resolvedMachineId = Number(normalizedMachine.id ?? normalizedMachine.machine_id ?? Number.NaN);
    if (!Number.isFinite(resolvedMachineId) || resolvedMachineId !== input.machine_id) {
      throw new Error(`Machine ${input.machine_id} was not found for set defjob.`);
    }

    const priceInetu = Number(normalizedMachine?.listed_inet_up_cost ?? 0.0048828125);
    const priceInetd = Number(normalizedMachine?.listed_inet_down_cost ?? 0.0048828125);
    const priceGpu = Number(input.price_gpu ?? normalizedMachine?.listed_gpu_cost ?? 1);

    return this.makeRequest('PUT', '/machines/create_bids/', undefined, {
      args: input.args ? input.args.split(' ').filter(Boolean) : [],
      image: input.image,
      machine: input.machine_id,
      price_gpu: priceGpu,
      price_inetd: priceInetd,
      price_inetu: priceInetu
    });
  }

  public async setMinBid(machineId: number, minBid: number): Promise<unknown> {
    return this.makeRequest('PUT', `/machines/${machineId}/minbid/`, undefined, {
      price: minBid
    });
  }

  public async showMachines(machineId?: number): Promise<unknown> {
    if (machineId !== undefined) {
      return this.makeRequest('GET', `/machines/${machineId}`);
    }

    return this.makeRequest('GET', '/machines');
  }

  public async upsertOffer(input: UpsertOfferInput): Promise<unknown> {
    return this.makeRequest('PUT', '/machines/create_asks/', undefined, {
      machine: input.machine_id,
      price_min_bid: input.min_bid
    });
  }

  public async updateHostScript(
    machineId: number,
    scriptName: string,
    scriptBody: string,
    restartAfterUpdate: boolean
  ): Promise<unknown> {
    throw new Error(
      `Host script update is not currently documented as a direct Vast API endpoint. ` +
      `Use host-side automation tooling or Vast CLI wrappers for machine ${machineId} ` +
      `(script: ${scriptName}, restart_after_update=${restartAfterUpdate}, bytes=${scriptBody.length}).`
    );
  }

  private normalizeEndpoint(endpoint: string): string {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    if (normalized.startsWith('/api/v0/')) {
      return normalized;
    }

    if (normalized.startsWith('/api/')) {
      return normalized;
    }

    return `/api/v0${normalized}`;
  }

  private safelySerialize(value: unknown): string | null {
    if (value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable error payload]';
    }
  }
}
