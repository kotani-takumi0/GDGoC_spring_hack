// =============================================================================
// 構造化ログ — Cloud Logging自動連携（Cloud Runではstdoutが自動転送）
// =============================================================================

type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

interface LogEntry {
  readonly severity: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly [key: string]: unknown;
}

function writeLog(severity: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  // Cloud Runではstdoutの構造化JSONがCloud Loggingに自動転送される
  if (severity === 'ERROR') {
    console.error(JSON.stringify(entry));
  } else if (severity === 'WARNING') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    writeLog('INFO', message, metadata);
  },

  warn(message: string, metadata?: Record<string, unknown>): void {
    writeLog('WARNING', message, metadata);
  },

  error(message: string, metadata?: Record<string, unknown>): void {
    writeLog('ERROR', message, metadata);
  },

  apiMetric(
    endpoint: string,
    latencyMs: number,
    status: number,
    tokenCount?: number
  ): void {
    writeLog('INFO', `API ${endpoint} completed`, {
      endpoint,
      latencyMs,
      httpStatus: status,
      tokenCount: tokenCount ?? null,
      type: 'api_metric',
    });
  },
};
