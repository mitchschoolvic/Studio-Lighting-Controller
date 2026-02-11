import log from 'electron-log';
import path from 'path';

/**
 * Configures electron-log for the application.
 * Writes logs to ~/Library/Logs/<appName>/
 */
export function initializeLogger(): typeof log {
  // Configure file transport
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  // Configure console transport
  log.transports.console.level = 'debug';
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

  // Override console methods to route through electron-log
  Object.assign(console, log.functions);

  log.info('Logger initialized');
  log.info(`Log file: ${log.transports.file.getFile().path}`);

  return log;
}

export { log };
