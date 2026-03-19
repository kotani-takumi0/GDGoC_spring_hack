import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { embedContent: mockEmbedContent };
  },
}));

import { embedQuery, embedDocument } from '@/lib/embedding-service';

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('embedQuery', () => {
    it('成功時に768次元のベクトルを返す', async () => {
      const mockValues = new Array(768).fill(0.1);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: mockValues }],
      });

      const result = await embedQuery('テスト質問');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(768);
      }
    });

    it('空のembedding時にエラーを返す', async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [] }],
      });

      const result = await embedQuery('テスト');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('EMPTY_EMBEDDING');
      }
    });

    it('API失敗時にエラーを返す', async () => {
      mockEmbedContent.mockRejectedValueOnce(new Error('API Error'));

      const result = await embedQuery('テスト');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('EMBEDDING_ERROR');
      }
    });
  });

  describe('embedDocument', () => {
    it('成功時にベクトルを返す', async () => {
      const mockValues = new Array(768).fill(0.2);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: mockValues }],
      });

      const result = await embedDocument('テストドキュメント');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(768);
      }
    });
  });
});
