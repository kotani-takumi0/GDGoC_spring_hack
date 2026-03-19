import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@/lib/logger';

describe('StructuredLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('info: 構造化JSONをstdoutに出力する', () => {
    logger.info('テストメッセージ', { key: 'value' });

    expect(console.log).toHaveBeenCalledTimes(1);
    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.severity).toBe('INFO');
    expect(output.message).toBe('テストメッセージ');
    expect(output.key).toBe('value');
    expect(output.timestamp).toBeDefined();
  });

  it('warn: stderrに出力する', () => {
    logger.warn('警告メッセージ');

    expect(console.warn).toHaveBeenCalledTimes(1);
    const output = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.severity).toBe('WARNING');
  });

  it('error: stderrに出力する', () => {
    logger.error('エラーメッセージ');

    expect(console.error).toHaveBeenCalledTimes(1);
    const output = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.severity).toBe('ERROR');
  });

  it('apiMetric: エンドポイント・レイテンシ・ステータスを記録する', () => {
    logger.apiMetric('/api/ask', 150, 200, 500);

    expect(console.log).toHaveBeenCalledTimes(1);
    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.endpoint).toBe('/api/ask');
    expect(output.latencyMs).toBe(150);
    expect(output.httpStatus).toBe(200);
    expect(output.tokenCount).toBe(500);
    expect(output.type).toBe('api_metric');
  });
});
