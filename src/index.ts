import { FastMCP } from 'fastmcp';

import { VastAIHostClient } from './client/VastAIHostClient.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import { MCPRules } from './rules/MCPRules.js';
import { registerHostTools } from './tools/hostTools.js';

const config = getConfig();
const logger = createLogger(config);
const client = VastAIHostClient.getInstance(config, logger);
const rules = new MCPRules(config);

const server = new FastMCP({
  instructions:
    'This MCP server manages Vast.ai host/provider operations only. It is intentionally focused on machine owners who ' +
    'list and maintain GPU infrastructure on Vast.ai. Use these tools to inspect machines, tune offers and default jobs, ' +
    'run self-tests, evaluate reliability, and support safe host-side automation. If a request is renter-centric, explain ' +
    'that this server is provider-focused and suggest using renter-focused tooling instead.',
  name: 'vastai-host-mcp',
  version: '0.1.0'
});

registerHostTools(server, {
  client,
  config,
  logger,
  rules
});

const start = async (): Promise<void> => {
  if (config.mcpTransport === 'httpStream') {
    logger.info(
      {
        host: config.mcpHttpHost,
        port: config.mcpHttpPort,
        transport: 'httpStream'
      },
      'Starting Vast.ai Host MCP server'
    );

    await server.start({
      httpStream: {
        host: config.mcpHttpHost,
        port: config.mcpHttpPort
      },
      transportType: 'httpStream'
    });

    return;
  }

  logger.info({ transport: 'stdio' }, 'Starting Vast.ai Host MCP server');
  await server.start({ transportType: 'stdio' });
};

start().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error({ error: err.message, stack: err.stack }, 'Failed to start MCP server');
  process.exitCode = 1;
});
