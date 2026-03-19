// =============================================================================
// Embedding Service — Gemini Embedding 2 によるテキストベクトル化
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type { Result, GeminiError } from '@/lib/gemini-client';

// =============================================================================
// 定数
// =============================================================================

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'gdghackathon-7ff23';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const OUTPUT_DIMENSIONALITY = 768;

// =============================================================================
// クライアント初期化
// =============================================================================

function createGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }
  return new GoogleGenAI({
    vertexai: true,
    project: GCP_PROJECT,
    location: GCP_LOCATION,
  });
}

let genaiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genaiInstance) {
    genaiInstance = createGenAI();
  }
  return genaiInstance;
}

// =============================================================================
// ヘルパー
// =============================================================================

function createError<T>(message: string, code: string): Result<T, GeminiError> {
  return { success: false, error: { message, code } };
}

function createSuccess<T>(data: T): Result<T, GeminiError> {
  return { success: true, data };
}

// =============================================================================
// Embedding API
// =============================================================================

/**
 * 検索クエリ用のベクトルを生成する（RETRIEVAL_QUERY）
 */
export async function embedQuery(
  text: string
): Promise<Result<readonly number[], GeminiError>> {
  return embed(text, 'RETRIEVAL_QUERY');
}

/**
 * ドキュメント保存用のベクトルを生成する（RETRIEVAL_DOCUMENT）
 */
export async function embedDocument(
  text: string
): Promise<Result<readonly number[], GeminiError>> {
  return embed(text, 'RETRIEVAL_DOCUMENT');
}

async function embed(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'
): Promise<Result<readonly number[], GeminiError>> {
  try {
    const ai = getGenAI();
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType,
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      },
    });

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      return createError('Embedding結果が空です', 'EMPTY_EMBEDDING');
    }

    return createSuccess(values);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Embedding生成に失敗しました';
    return createError(message, 'EMBEDDING_ERROR');
  }
}
