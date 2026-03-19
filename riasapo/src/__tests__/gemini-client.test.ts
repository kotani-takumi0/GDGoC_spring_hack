import { describe, it, expect, vi, beforeEach } from 'vitest';

// @google/genai のモック
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = { generateContent: mockGenerateContent };
    },
  };
});

// テスト対象（モック適用後にインポート）
import { geminiClient } from '@/lib/gemini-client';
import type { ConceptNodeData } from '@/types';

// =============================================================================
// テストデータ
// =============================================================================

const mockNode: ConceptNodeData = {
  id: 'variables',
  title: '変数',
  subtitle: 'データを格納する仕組み',
  status: 'default',
};

// =============================================================================
// テスト
// =============================================================================

describe('geminiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('personalizeDescriptions', () => {
    it('成功時にPersonalizedNode配列を返す', async () => {
      const mockResponse = [
        { id: 'variables', title: '変数', subtitle: 'データを入れる箱のようなもの' },
      ];
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      });

      const result = await geminiClient.personalizeDescriptions(
        [mockNode],
        'complete-beginner'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('variables');
      }
    });

    it('API失敗時にリトライしてエラーを返す', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      const result = await geminiClient.personalizeDescriptions(
        [mockNode],
        'complete-beginner'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VERTEX_AI_ERROR');
      }
      // MAX_RETRIES=2 なので3回呼ばれる
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateCode', () => {
    it('成功時にGeneratedCodeを返す', async () => {
      const mockResponse = {
        files: [{ filename: 'main.ts', code: 'const x = 1;', description: 'メインファイル' }],
        language: 'typescript',
        explanation: 'サンプルコード',
      };
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      });

      const result = await geminiClient.generateCode(
        {
          id: 'todo-app',
          title: 'Todoアプリ',
          description: 'タスク管理アプリ',
          nodes: [],
          edges: [],
          fallbackMappings: [],
        },
        'complete-beginner'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(1);
        expect(result.data.language).toBe('typescript');
      }
    });
  });

  describe('evaluateUnderstanding', () => {
    it('成功時にEvaluationResultを返す', async () => {
      const mockResponse = { score: 75, feedback: '良い理解です', status: 'green' };
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      });

      const result = await geminiClient.evaluateUnderstanding(
        mockNode,
        'const x = 1;',
        '変数はデータを保存する箱です'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(75);
        expect(result.data.status).toBe('green');
      }
    });
  });

  describe('askAboutConcept', () => {
    it('成功時に回答文字列を返す', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ answer: '変数とはデータを格納する仕組みです' }),
      });

      const result = await geminiClient.askAboutConcept(
        mockNode,
        '変数とは？',
        'テストプロンプト'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain('変数');
      }
    });
  });

  describe('mapConceptsToCode', () => {
    it('成功時にConceptCodeMapping配列を返す', async () => {
      const mockResponse = [
        { nodeId: 'variables', codeSnippet: 'const x = 1;', explanation: '変数の宣言' },
      ];
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      });

      const result = await geminiClient.mapConceptsToCode(
        [mockNode],
        'const x = 1;'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].nodeId).toBe('variables');
      }
    });
  });

  describe('リトライロジック', () => {
    it('JSON parseエラー時にリトライする', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'invalid json' })
        .mockResolvedValueOnce({ text: 'still invalid' })
        .mockResolvedValueOnce({ text: JSON.stringify({ answer: 'OK' }) });

      const result = await geminiClient.askAboutConcept(mockNode, 'test', 'prompt');

      expect(result.success).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('空レスポンス時にリトライする', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: null })
        .mockResolvedValueOnce({ text: '' })
        .mockResolvedValueOnce({ text: null });

      const result = await geminiClient.askAboutConcept(mockNode, 'test', 'prompt');

      expect(result.success).toBe(false);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
  });
});
