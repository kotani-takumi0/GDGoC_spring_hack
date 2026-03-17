// =============================================================================
// POST /api/mapping - 概念ノードとコードのマッピングAPI
// =============================================================================

import { NextResponse } from 'next/server';

import { geminiClient } from '@/lib/gemini-client';
import type { ConceptCodeMapping } from '@/lib/gemini-client';
import { getScenario } from '@/lib/scenario-data-loader';
import type { ConceptNodeData, FallbackMapping } from '@/types';

// =============================================================================
// リクエスト / レスポンス型
// =============================================================================

interface MappingRequestBody {
  readonly scenarioId: string;
  readonly code: string;
  readonly nodes: readonly { readonly id: string; readonly title: string }[];
}

interface MappingResponseItem {
  readonly nodeId: string;
  readonly codeSnippet: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly explanation: string;
}

interface MappingResponse {
  readonly mappings: readonly MappingResponseItem[];
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * コード全文中からスニペットの行範囲を検索する。
 * 見つからない場合は startLine: 0, endLine: 0 を返す。
 */
function findLineRange(
  fullCode: string,
  snippet: string
): { readonly startLine: number; readonly endLine: number } {
  const lines = fullCode.split('\n');
  const snippetFirstLine = snippet.split('\n')[0].trim();

  if (snippetFirstLine === '') {
    return { startLine: 0, endLine: 0 };
  }

  const startIdx = lines.findIndex((l) => l.trim().includes(snippetFirstLine));

  if (startIdx === -1) {
    return { startLine: 0, endLine: 0 };
  }

  const snippetLines = snippet.split('\n').length;
  return { startLine: startIdx + 1, endLine: startIdx + snippetLines };
}

/**
 * Gemini の ConceptCodeMapping に行番号情報を付与する。
 */
function enrichWithLineNumbers(
  mappings: readonly ConceptCodeMapping[],
  fullCode: string
): readonly MappingResponseItem[] {
  return mappings.map((m) => {
    const { startLine, endLine } = findLineRange(fullCode, m.codeSnippet);
    return {
      nodeId: m.nodeId,
      codeSnippet: m.codeSnippet,
      startLine,
      endLine,
      explanation: m.explanation,
    };
  });
}

/**
 * FallbackMapping からレスポンス形式に変換する。
 * startLine/endLine は 0 で埋める。
 */
function convertFallbackMappings(
  fallbacks: readonly FallbackMapping[]
): readonly MappingResponseItem[] {
  return fallbacks.map((fb) => ({
    nodeId: fb.nodeId,
    codeSnippet: fb.codeExample,
    startLine: 0,
    endLine: 0,
    explanation: fb.explanation,
  }));
}

/**
 * リクエストボディのバリデーション。
 * 不正な場合はエラーメッセージを返し、正常なら null を返す。
 */
function validateRequestBody(
  body: unknown
): { readonly error: string } | null {
  if (body === null || typeof body !== 'object') {
    return { error: 'リクエストボディが不正です' };
  }

  const { scenarioId, code, nodes } = body as Record<string, unknown>;

  if (typeof scenarioId !== 'string' || scenarioId.trim() === '') {
    return { error: 'scenarioId は必須の文字列です' };
  }

  if (typeof code !== 'string' || code.trim() === '') {
    return { error: 'code は必須の文字列です' };
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { error: 'nodes は1つ以上の要素を持つ配列です' };
  }

  for (const node of nodes) {
    if (
      node === null ||
      typeof node !== 'object' ||
      typeof (node as Record<string, unknown>).id !== 'string' ||
      typeof (node as Record<string, unknown>).title !== 'string'
    ) {
      return { error: 'nodes の各要素には id (string) と title (string) が必要です' };
    }
  }

  return null;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: Request): Promise<NextResponse<MappingResponse | { error: string }>> {
  // リクエストボディのパース
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディのJSONパースに失敗しました' },
      { status: 400 }
    );
  }

  // バリデーション
  const validationError = validateRequestBody(body);
  if (validationError !== null) {
    return NextResponse.json(validationError, { status: 400 });
  }

  const { scenarioId, code, nodes } = body as MappingRequestBody;

  // nodes を ConceptNodeData 形式に変換
  const conceptNodes: readonly ConceptNodeData[] = nodes.map((n) => ({
    id: n.id,
    title: n.title,
    subtitle: '',
    status: 'default' as const,
  }));

  // Gemini API でマッピング生成
  const result = await geminiClient.mapConceptsToCode(conceptNodes, code);

  if (result.success) {
    // 成功: 行番号を付与して返す
    const mappings = enrichWithLineNumbers(result.data, code);
    return NextResponse.json({ mappings });
  }

  // 失敗: フォールバックマッピングを使用
  console.warn(
    `Gemini API マッピング失敗 (scenarioId: ${scenarioId}): ${result.error.message}. フォールバックを使用します。`
  );

  try {
    const scenario = getScenario(scenarioId);
    const mappings = convertFallbackMappings(scenario.fallbackMappings);
    return NextResponse.json({ mappings });
  } catch (e) {
    // シナリオも見つからない場合は空のマッピングを返す
    console.error(
      `フォールバックシナリオ取得失敗 (scenarioId: ${scenarioId}):`,
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ mappings: [] });
  }
}
