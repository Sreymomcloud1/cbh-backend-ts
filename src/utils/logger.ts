// src/utils/logger.ts
import { createLogger, format, transports } from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    isDev
      ? format.combine(
          format.colorize(),
          format.printf(({ timestamp, level, message, ...meta }) => {
            const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${level}] ${message}${extra}`;
          })
        )
      : format.json()
  ),
  transports: [new transports.Console()],
});

export default logger;
