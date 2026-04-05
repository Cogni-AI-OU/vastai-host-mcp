import type { ContentResult, FastMCP } from 'fastmcp';
import type pino from 'pino';
import { z } from 'zod';

import type { AppConfig } from '../config.js';
import type { VastAIHostClient } from '../client/VastAIHostClient.js';
import type { MCPRules } from '../rules/MCPRules.js';

interface ToolDeps {
  client: VastAIHostClient;
  config: AppConfig;
  logger: pino.Logger;
  rules: MCPRules;
}

interface ToolResult {
  data?: unknown;
  fallback_used?: boolean;
  message: string;
  ok: boolean;
  troubleshooting?: string[];
}

const toContentResult = (result: ToolResult): ContentResult => ({
  content: [
    {
      text:
        `${result.message}\n\n` +
        JSON.stringify(
          {
            data: result.data ?? null,
            fallback_used: result.fallback_used ?? false,
            ok: result.ok,
            troubleshooting: result.troubleshooting ?? []
          },
          null,
          2
        ),
      type: 'text'
    }
  ],
  isError: !result.ok
});

const buildFailureResult = (error: unknown, additional?: string[]): ToolResult => {
  const message = error instanceof Error ? error.message : String(error);

  return {
    fallback_used: false,
    message,
    ok: false,
    troubleshooting: [
      'Verify VAST_API_KEY is valid and has host/provider permissions.',
      'Ensure VAST_SERVER_URL is reachable from this runtime environment.',
      ...(additional ?? [])
    ]
  };
};

const executeWithFallback = async (
  deps: ToolDeps,
  operation: string,
  apiCall: () => Promise<unknown>,
  cliArgs?: string[]
): Promise<ToolResult> => {
  try {
    const data = await apiCall();

    return {
      data,
      fallback_used: false,
      message: `${operation} completed through Vast.ai API.`,
      ok: true
    };
  } catch (apiError) {
    deps.logger.warn(
      {
        error: apiError instanceof Error ? apiError.message : String(apiError),
        operation
      },
      'API operation failed; evaluating CLI fallback'
    );

    if (!deps.config.vastUseCliFallback || cliArgs === undefined) {
      return buildFailureResult(apiError, ['CLI fallback unavailable for this tool invocation.']);
    }

    try {
      const cliResult = await deps.client.runCliCommand(cliArgs);

      return {
        data: {
          cli_args: cliResult.args,
          stderr: cliResult.stderr,
          stdout: cliResult.stdout
        },
        fallback_used: true,
        message: `${operation} completed through Vast.ai CLI fallback.`,
        ok: true
      };
    } catch (cliError) {
      const apiMessage = apiError instanceof Error ? apiError.message : String(apiError);
      const cliMessage = cliError instanceof Error ? cliError.message : String(cliError);

      return {
        fallback_used: true,
        message: `${operation} failed via API and CLI fallback. API: ${apiMessage} | CLI: ${cliMessage}`,
        ok: false,
        troubleshooting: [
          'Confirm the machine ID is owned by this host account.',
          'Confirm Vast CLI is installed and accessible in PATH if fallback is enabled.',
          'Double-check host daemon status and maintenance windows on the provider node.'
        ]
      };
    }
  }
};

export const registerHostTools = (server: FastMCP, deps: ToolDeps): void => {
  server.addTool({
    name: 'vastai_host_show_machines',
    description:
      'List all machines owned by the current Vast.ai provider account, or inspect one machine by ID. ' +
      'Use this as your first diagnostic step before changing offers, default jobs, or reliability settings. ' +
      'Example calls: {"machine_id": 12345} for a single host machine or {} to enumerate all host machines. ' +
      'Expected output includes machine metadata, listing state, and host-visible health details where available.',
    parameters: z.object({
      machine_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Optional machine ID. If omitted, all host-owned machines are returned.')
    }),
    execute: async ({ machine_id }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          machine_id ? `Show machine ${machine_id}` : 'Show host machines',
          () => deps.client.showMachines(machine_id),
          machine_id ? ['show', 'machine', String(machine_id)] : ['show', 'machines']
        )
      )
  });

  server.addTool({
    name: 'vastai_host_set_defjob',
    description:
      'Create or update the default job for a host machine. This controls base image, launch arguments, ' +
      'startup command, and optional default GPU price guidance. Use this to standardize renter startup behavior ' +
      'for your hosted machines. Example: set CUDA image + benchmark args for machine 12345. ' +
      'Warning: changing default jobs impacts future launches and should be coordinated with your host scripts.',
    parameters: z.object({
      args: z
        .string()
        .optional()
        .describe('Optional runtime arguments for the default job, e.g. --ipc=host --shm-size=8g.'),
      env: z
        .record(z.string(), z.string())
        .optional()
        .describe('Optional environment variables for the default job.'),
      image: z
        .string()
        .optional()
        .describe('Container image for the default job, e.g. nvidia/cuda:12.4.1-runtime-ubuntu22.04.'),
      machine_id: z.number().int().positive().describe('Target host machine ID.'),
      onstart_cmd: z
        .string()
        .optional()
        .describe('Optional startup command to run when the default job initializes.'),
      price_gpu: z
        .number()
        .positive()
        .optional()
        .describe('Optional suggested GPU price for host-side defaults.')
    }),
    execute: async (input) => {
      const cliArgs = ['set', 'defjob', String(input.machine_id)];
      if (input.image) {
        cliArgs.push('--image', input.image);
      }

      if (input.args) {
        cliArgs.push('--args', input.args);
      }

      if (input.onstart_cmd) {
        cliArgs.push('--onstart-cmd', input.onstart_cmd);
      }

      if (input.price_gpu !== undefined) {
        cliArgs.push('--price-gpu', String(input.price_gpu));
      }

      return toContentResult(
        await executeWithFallback(
          deps,
          `Set default job on machine ${input.machine_id}`,
          () => deps.client.setDefaultJob(input),
          cliArgs
        )
      );
    }
  });

  server.addTool({
    name: 'vastai_host_upsert_offer',
    description:
      'Create a new host offer or update an existing offer for a machine. Use this for pricing adjustments, ' +
      'min/max bid control, and storage-linked offer updates. This is one of the primary host monetization tools. ' +
      'If offer_id is provided, the tool updates; otherwise it creates a new offer tied to machine_id.',
    parameters: z.object({
      disk_space: z
        .number()
        .nonnegative()
        .optional()
        .describe('Optional disk space value for the offer in GB.'),
      machine_id: z.number().int().positive().describe('Host machine ID for the offer.'),
      max_bid: z
        .number()
        .positive()
        .optional()
        .describe('Optional max bid cap for the offer.'),
      min_bid: z
        .number()
        .positive()
        .optional()
        .describe('Optional minimum rental price for the machine offer.'),
      offer_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Optional offer ID. If present, updates the existing offer.')
    }),
    execute: async (input) => {
      const cliArgs =
        input.offer_id !== undefined
          ? ['list', 'machine', String(input.machine_id)]
          : ['list', 'machine', String(input.machine_id)];

      if (input.min_bid !== undefined) {
        cliArgs.push('--min-bid', String(input.min_bid));
      }

      if (input.max_bid !== undefined) {
        cliArgs.push('--max-bid', String(input.max_bid));
      }

      return toContentResult(
        await executeWithFallback(
          deps,
          input.offer_id !== undefined
            ? `Update offer ${input.offer_id} for machine ${input.machine_id}`
            : `Create offer for machine ${input.machine_id}`,
          () => deps.client.upsertOffer(input),
          cliArgs
        )
      );
    }
  });

  server.addTool({
    name: 'vastai_host_set_min_bid',
    description:
      'Set the machine-level minimum bid (rental floor price) for a host machine. ' +
      'This is useful when market demand changes and you need to protect revenue minimums. ' +
      'Example: machine 12345 min_bid 0.32. Expected output confirms update status and fallback path used.',
    parameters: z.object({
      machine_id: z.number().int().positive().describe('Target host machine ID.'),
      min_bid: z.number().positive().describe('New minimum bid/rental price for the machine.')
    }),
    execute: async ({ machine_id, min_bid }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          `Set min bid on machine ${machine_id}`,
          () => deps.client.setMinBid(machine_id, min_bid),
          ['set', 'min-bid', String(machine_id), String(min_bid)]
        )
      )
  });

  server.addTool({
    name: 'vastai_host_verification_status',
    description:
      'Fetch host verification status either globally for the account or for one machine. ' +
      'Use this before listing machines to ensure reliability and trust signals remain healthy. ' +
      'If machine_id is omitted, account-level verification view is requested.',
    parameters: z.object({
      machine_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Optional machine ID for per-machine verification status.')
    }),
    execute: async ({ machine_id }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          machine_id
            ? `Get verification status for machine ${machine_id}`
            : 'Get host verification status',
          () => deps.client.getVerificationStatus(machine_id),
          machine_id
            ? ['show', 'machine', String(machine_id)]
            : ['show', 'machines']
        )
      )
  });

  server.addTool({
    name: 'vastai_host_self_test_machine',
    description:
      'Run a self-test on a host machine to validate hardware and host readiness. ' +
      'This helps maintain provider reliability and can reduce failed renter jobs. ' +
      'Set quick=true for lighter checks, quick=false for fuller validation where supported.',
    parameters: z.object({
      machine_id: z.number().int().positive().describe('Target host machine ID for self-test.'),
      quick: z
        .boolean()
        .default(false)
        .describe('If true, request a quicker self-test profile when supported by Vast.ai.')
    }),
    execute: async ({ machine_id, quick }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          `Run self-test for machine ${machine_id}`,
          () => deps.client.runSelfTest(machine_id, quick),
          ['self-test', 'machine', String(machine_id)]
        )
      )
  });

  server.addTool({
    name: 'vastai_host_get_stats',
    description:
      'Retrieve host/provider operational stats such as earnings trend, reliability score inputs, and uptime metrics. ' +
      'Use this to monitor machine fleet health and identify pricing or stability actions. ' +
      'The tool returns raw host stats plus automation-rule status summary.',
    parameters: z.object({}),
    execute: async () => {
      const result = await executeWithFallback(
        deps,
        'Get host earnings/reliability/uptime stats',
        () => deps.client.getHostStats(),
        ['show', 'machines']
      );

      if (!result.ok) {
        return toContentResult(result);
      }

      return toContentResult({
        ...result,
        data: {
          automation: deps.rules.getAutomationSummary(),
          host_stats: result.data
        }
      });
    }
  });

  server.addTool({
    name: 'vastai_host_recommend_pricing',
    description:
      'Generate a pricing recommendation using host-side MCP rules from DLPerf score, utilization, and reliability. ' +
      'This does not directly apply pricing; it returns a recommendation for operator review before changing offers.',
    parameters: z.object({
      current_price_gpu: z.number().positive().describe('Current machine GPU price.'),
      dlperf_score: z.number().nonnegative().describe('Recent DLPerf score for the machine/GPU profile.'),
      gpu_utilization_percent: z
        .number()
        .min(0)
        .max(100)
        .describe('Recent utilization percent, from 0 to 100.'),
      reliability_score: z
        .number()
        .min(0)
        .max(100)
        .describe('Host reliability score from 0 to 100.')
    }),
    execute: async (input) => {
      const recommendation = deps.rules.recommendPricing(input);

      return toContentResult({
        data: recommendation,
        fallback_used: false,
        message: 'Generated host pricing recommendation successfully.',
        ok: true
      });
    }
  });

  server.addTool({
    name: 'vastai_host_update_script',
    description:
      'Update host-side maintenance/boot scripts for a machine and optionally restart daemon components afterwards. ' +
      'Use this for automated updates, host hardening, or provisioning routines. ' +
      'Warning: script changes can impact machine availability and renter workloads.',
    parameters: z.object({
      machine_id: z.number().int().positive().describe('Target host machine ID.'),
      restart_after_update: z
        .boolean()
        .default(false)
        .describe('If true, request service restart after script update.'),
      script_body: z
        .string()
        .min(1)
        .describe('Script content to install or update on the host machine.'),
      script_name: z
        .string()
        .min(1)
        .describe('Logical script name, such as startup.sh or host-maintenance.sh.')
    }),
    execute: async ({ machine_id, restart_after_update, script_body, script_name }) => {
      const cliArgs = ['set', 'defjob', String(machine_id), '--onstart-cmd', script_name];

      return toContentResult(
        await executeWithFallback(
          deps,
          `Update host script ${script_name} on machine ${machine_id}`,
          () => deps.client.updateHostScript(machine_id, script_name, script_body, restart_after_update),
          cliArgs
        )
      );
    }
  });

  server.addTool({
    name: 'vastai_host_restart_daemon',
    description:
      'Restart host daemon components for a machine. Useful when host reliability degrades or when config/script ' +
      'changes require service restart. Example components include docker, sshd, or provider-specific daemon units.',
    parameters: z.object({
      component: z
        .string()
        .optional()
        .describe('Optional daemon component name; if omitted, server chooses default restart scope.'),
      machine_id: z.number().int().positive().describe('Target host machine ID.')
    }),
    execute: async ({ component, machine_id }) => {
      const cliArgs = ['cleanup', 'machine', String(machine_id)];

      return toContentResult(
        await executeWithFallback(
          deps,
          `Restart daemon for machine ${machine_id}`,
          () => deps.client.restartDaemon(machine_id, component),
          cliArgs
        )
      );
    }
  });

  server.addTool({
    name: 'vastai_host_search_offers',
    description:
      'Search and filter host offers using query parameters. This helps providers inspect existing listings and ' +
      'market fit by machine, bid range, and active status. The query object is passed directly to Vast.ai API ' +
      'offer search endpoints for flexible filtering.',
    parameters: z.object({
      query: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .default({})
        .describe('Key/value query parameters forwarded to offer search endpoints.')
    }),
    execute: async ({ query }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          'Search host offers',
          () => deps.client.searchOffers(query),
          ['list', 'machines']
        )
      )
  });

  server.addTool({
    name: 'vastai_host_show_logs',
    description:
      'Retrieve host logs for a machine for troubleshooting reliability incidents, failed jobs, or daemon issues. ' +
      'Use this when jobs fail repeatedly or when machine verification degrades unexpectedly.',
    parameters: z.object({
      lines: z
        .number()
        .int()
        .positive()
        .max(5000)
        .default(200)
        .describe('How many recent log lines to fetch.'),
      machine_id: z.number().int().positive().describe('Target host machine ID.')
    }),
    execute: async ({ lines, machine_id }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          `Get host logs for machine ${machine_id}`,
          () => deps.client.getHostLogs(machine_id, lines),
          ['show', 'machine', String(machine_id)]
        )
      )
  });

  server.addTool({
    name: 'vastai_host_network_status',
    description:
      'Inspect host network and performance-related status for a machine, including indicators that influence ' +
      'download speed, stability, and renter experience. Use this during onboarding, diagnostics, and pre-list checks.',
    parameters: z.object({
      machine_id: z.number().int().positive().describe('Target host machine ID.')
    }),
    execute: async ({ machine_id }) =>
      toContentResult(
        await executeWithFallback(
          deps,
          `Get network status for machine ${machine_id}`,
          () => deps.client.getNetworkStatus(machine_id),
          ['show', 'machine', String(machine_id)]
        )
      )
  });

  server.addTool({
    name: 'vastai_host_reliability_actions',
    description:
      'Generate reliability-focused host action recommendations from uptime, failed jobs, and verification signals. ' +
      'This is advisory output to help providers prioritize maintenance and avoid listing penalties.',
    parameters: z.object({
      failed_jobs_24h: z.number().int().min(0).describe('Count of failed jobs in the last 24 hours.'),
      uptime_percent_30d: z
        .number()
        .min(0)
        .max(100)
        .describe('Uptime percent over the last 30 days.'),
      verification_passed: z.boolean().describe('Whether current verification checks are passing.')
    }),
    execute: async (input) =>
      toContentResult({
        data: deps.rules.recommendReliabilityActions(input),
        fallback_used: false,
        message: 'Generated reliability recommendations successfully.',
        ok: true
      })
  });
};
