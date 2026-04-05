import 'dotenv/config';

import { z } from 'zod';

const rawEnvSchema = z.object({
  VAST_API_KEY: z.string().min(1, 'VAST_API_KEY is required and cannot be empty.'),
  VAST_SERVER_URL: z.string().url().default('https://console.vast.ai'),
  MCP_TRANSPORT: z.enum(['stdio', 'httpStream']).default('stdio'),
  MCP_HTTP_HOST: z.string().default('0.0.0.0'),
  MCP_HTTP_PORT: z.string().default('8080'),
  VAST_REQUEST_TIMEOUT_MS: z.string().default('30000'),
  VAST_USE_CLI_FALLBACK: z.string().default('true'),
  VAST_CLI_PATH: z.string().default('vastai'),
  VAST_AUTO_PRICING_ENABLED: z.string().default('false'),
  VAST_AUTO_RELIABILITY_GUARD: z.string().default('false'),
  LOG_LEVEL: z.string().default('info')
});

const parseBoolean = (value: string, fieldName: string): boolean => {
  const normalized = value.trim().toLowerCase();
  const truthy = ['1', 'true', 'yes', 'on'];
  const falsy = ['0', 'false', 'no', 'off'];

  if (truthy.includes(normalized)) {
    return true;
  }

  if (falsy.includes(normalized)) {
    return false;
  }

  throw new Error(
    `${fieldName} must be one of: ${truthy.concat(falsy).join(', ')}. Received: ${value}.`
  );
};

const parseInteger = (value: string, fieldName: string): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer. Received: ${value}.`);
  }

  return parsed;
};

export interface AppConfig {
  logLevel: string;
  mcpHttpHost: string;
  mcpHttpPort: number;
  mcpTransport: 'stdio' | 'httpStream';
  vastApiKey: string;
  vastAutoPricingEnabled: boolean;
  vastAutoReliabilityGuard: boolean;
  vastCliPath: string;
  vastRequestTimeoutMs: number;
  vastServerUrl: string;
  vastUseCliFallback: boolean;
}

let cachedConfig: AppConfig | null = null;

export const getConfig = (): AppConfig => {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const parsedEnv = rawEnvSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join(' | ');
    throw new Error(
      `Environment validation failed. ${issues}. ` +
        'Copy .env.example to .env and set at least VAST_API_KEY.'
    );
  }

  const env = parsedEnv.data;
  cachedConfig = {
    logLevel: env.LOG_LEVEL,
    mcpHttpHost: env.MCP_HTTP_HOST,
    mcpHttpPort: parseInteger(env.MCP_HTTP_PORT, 'MCP_HTTP_PORT'),
    mcpTransport: env.MCP_TRANSPORT,
    vastApiKey: env.VAST_API_KEY,
    vastAutoPricingEnabled: parseBoolean(env.VAST_AUTO_PRICING_ENABLED, 'VAST_AUTO_PRICING_ENABLED'),
    vastAutoReliabilityGuard: parseBoolean(
      env.VAST_AUTO_RELIABILITY_GUARD,
      'VAST_AUTO_RELIABILITY_GUARD'
    ),
    vastCliPath: env.VAST_CLI_PATH,
    vastRequestTimeoutMs: parseInteger(env.VAST_REQUEST_TIMEOUT_MS, 'VAST_REQUEST_TIMEOUT_MS'),
    vastServerUrl: env.VAST_SERVER_URL.replace(/\/+$/, ''),
    vastUseCliFallback: parseBoolean(env.VAST_USE_CLI_FALLBACK, 'VAST_USE_CLI_FALLBACK')
  };

  return cachedConfig;
};
