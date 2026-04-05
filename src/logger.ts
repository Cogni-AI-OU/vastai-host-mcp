import pino from 'pino';

import type { AppConfig } from './config.js';

export const createLogger = (config: AppConfig): pino.Logger =>
  pino({
    level: config.logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['apiKey', 'authorization', 'headers.authorization', 'process.env.VAST_API_KEY'],
      censor: '[REDACTED]'
    }
  });
