export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    const entry = this.formatEntry(level, message, data, error);
    const logMessage = `[${this.context}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry);
        break;
      case LogLevel.INFO:
        console.info(logMessage, entry);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, entry);
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
