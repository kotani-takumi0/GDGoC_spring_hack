// =============================================================================
// Gemini API 共通クライアント - REST API直接呼び出し
// =============================================================================

import type {
  ConceptNodeData,
  ExperienceLevel,
  ScenarioDefinition,
} from '@/types';

// =============================================================================
// 型定義（後で src/types/index.ts に統合予定）
// =============================================================================

/** Result型: 成功またはエラーを表す判別共用体 */
export type Result<T, E> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/** Gemini APIエラー */
export interface GeminiError {
  readonly message: string;
  readonly code: string;
}

/** パーソナライズされたノード */
export interface PersonalizedNode {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

/** 生成されたファイル1つ分 */
export interface GeneratedFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

/** 生成されたコード（複数ファイル） */
export interface GeneratedCode {
  readonly files: readonly GeneratedFile[];
  readonly language: string;
  readonly explanation: string;
}

/** 概念とコードのマッピング */
export interface ConceptCodeMapping {
  readonly nodeId: string;
  readonly codeSnippet: string;
  readonly explanation: string;
}

/** 理解度評価の結果 */
export interface EvaluationResult {
  readonly score: number;
  readonly feedback: string;
  readonly status: 'green' | 'yellow' | 'red';
}

// =============================================================================
// 定数
// =============================================================================

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

// =============================================================================
// ヘルパー関数
// =============================================================================

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY が設定されていません。.env.local に GEMINI_API_KEY を設定してください。'
    );
  }
  return key;
}

function createErrorResult<T>(
  message: string,
  code: string
): Result<T, GeminiError> {
  return { success: false, error: { message, code } };
}

function createSuccessResult<T>(data: T): Result<T, GeminiError> {
  return { success: true, data };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Gemini API 共通リクエスト関数
// =============================================================================

/**
 * Gemini API にリクエストを送信し、構造化 JSON レスポンスを取得する。
 * リトライ（指数バックオフ）とJSON parse失敗時の安全な処理を含む。
 *
 * @param prompt - プロンプト文字列
 * @param responseSchema - 期待するレスポンスのJSONスキーマ
 * @param retries - 残りリトライ回数（デフォルト: MAX_RETRIES）
 */
async function callGeminiAPI<T>(
  prompt: string,
  responseSchema: object,
  retries: number = MAX_RETRIES
): Promise<Result<T, GeminiError>> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'APIキーの取得に失敗しました';
    return createErrorResult<T>(message, 'API_KEY_MISSING');
  }

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  };

  let lastError: GeminiError = { message: '不明なエラー', code: 'UNKNOWN' };

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        lastError = {
          message: `Gemini API エラー (HTTP ${response.status}): ${errorBody}`,
          code: `HTTP_${response.status}`,
        };
        continue;
      }

      const responseData = await response.json();

      // レスポンスからテキストを抽出
      const text =
        responseData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

      if (text === null) {
        lastError = {
          message: 'Gemini API レスポンスにテキストが含まれていません',
          code: 'EMPTY_RESPONSE',
        };
        continue;
      }

      // JSON parse
      try {
        const parsed = JSON.parse(text) as T;
        return createSuccessResult(parsed);
      } catch {
        lastError = {
          message: `JSON パースに失敗しました: ${text.substring(0, 200)}`,
          code: 'JSON_PARSE_ERROR',
        };
        continue;
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'ネットワークエラーが発生しました';
      lastError = { message, code: 'NETWORK_ERROR' };
      continue;
    }
  }

  // 全リトライ失敗
  return createErrorResult<T>(
    `${retries + 1}回の試行後に失敗: ${lastError.message}`,
    lastError.code
  );
}

// =============================================================================
// スキーマ定義
// =============================================================================

const personalizedNodeSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      title: { type: 'STRING' },
      subtitle: { type: 'STRING' },
    },
    required: ['id', 'title', 'subtitle'],
  },
} as const;

const generatedCodeSchema = {
  type: 'OBJECT',
  properties: {
    files: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          filename: { type: 'STRING' },
          code: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['filename', 'code', 'description'],
      },
    },
    language: { type: 'STRING' },
    explanation: { type: 'STRING' },
  },
  required: ['files', 'language', 'explanation'],
} as const;

const conceptCodeMappingSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      nodeId: { type: 'STRING' },
      codeSnippet: { type: 'STRING' },
      explanation: { type: 'STRING' },
    },
    required: ['nodeId', 'codeSnippet', 'explanation'],
  },
} as const;

const evaluationResultSchema = {
  type: 'OBJECT',
  properties: {
    score: { type: 'NUMBER' },
    feedback: { type: 'STRING' },
    status: { type: 'STRING', enum: ['green', 'yellow', 'red'] },
  },
  required: ['score', 'feedback', 'status'],
} as const;

// =============================================================================
// プロンプトビルダー
// =============================================================================

function buildPersonalizePrompt(
  nodes: readonly ConceptNodeData[],
  experienceLevel: ExperienceLevel
): string {
  const levelLabel = {
    'complete-beginner': 'プログラミング完全初心者',
    'python-experienced': 'Python経験者',
    'other-language-experienced': '他言語経験者',
  }[experienceLevel];

  return `あなたはプログラミング学習支援AIです。
以下の概念ノードの説明文（subtitle）を、ユーザーの経験レベルに合わせてパーソナライズしてください。

## ユーザーの経験レベル
${levelLabel}

## 概念ノード一覧
${JSON.stringify(nodes, null, 2)}

## 指示
- 各ノードの subtitle を経験レベルに合わせて分かりやすく書き直してください
- id と title はそのまま維持してください
- 初心者には身近な例えを使い、経験者には技術的に正確な説明をしてください`;
}

function buildGenerateCodePrompt(
  scenario: ScenarioDefinition,
  experienceLevel: ExperienceLevel
): string {
  const levelLabel = {
    'complete-beginner': 'プログラミング完全初心者',
    'python-experienced': 'Python経験者',
    'other-language-experienced': '他言語経験者',
  }[experienceLevel];

  const concepts = scenario.nodes
    .filter((n) => n.nodeType !== 'feature' && n.nodeType !== 'app')
    .map((n) => n.title)
    .join('、');

  return `あなたはプログラミング学習支援AIです。
以下のシナリオに基づいて、TypeScriptの学習用サンプルコードを複数ファイルに分けて生成してください。

## シナリオ
タイトル: ${scenario.title}
説明: ${scenario.description}
含まれる概念: ${concepts}

## ユーザーの経験レベル
${levelLabel}

## 指示
- 言語は必ずTypeScriptを使用してください
- 以下の概念を含むコードを、役割ごとに2〜4個のファイルに分割してください: ${concepts}
- 例: index.html (基本のUI)、types.ts（型定義・変数）、main.ts（ロジック・関数・DOM操作）など
- 各ファイルは実行可能で、各概念がどこに対応するか日本語コメントで分かりやすく示してください
- IMPORTANT: プレビュー画面で実行可能にするため、必ず \`index.html\` を生成し、そこにアプリケーションのUIを構成するDOM要素（例: \`<div id="app"></div>\`）を含めてください。
- IMPORTANT: TypeScriptはブラウザのプレビュー環境(Babel standalone)で実行されます。以下は絶対に使わないでください: \`import\`, \`export\`, \`require\`, \`module.exports\`, Node.js API（fs, pathなど）。全てグローバルスコープで動作するバニラTS/JSで書いてください。
- IMPORTANT: 複数ファイルのコードは1つの\`<script>\`ブロックに結合して実行されます。ファイル間でグローバル変数・関数・クラスを直接参照してください。
- files 配列の各要素に filename, code, description を返してください
- filenameには \`index.html\`, \`main.ts\` のような形式の拡張子をつけてください
- CRITICAL: code フィールドには必ず改行文字（\\n）を使って読みやすくフォーマットされたソースコードを返してください。1行にまとめないでください。インデントも正しくつけてください。
- explanation にはコード全体の概要を日本語で説明してください
- language には "typescript" を返してください`;
}

function buildMapConceptsPrompt(
  nodes: readonly ConceptNodeData[],
  code: string
): string {
  return `あなたはプログラミング学習支援AIです。
以下のコード（複数ファイル）と概念ノードの対応関係を分析してください。

## 概念ノード一覧
${JSON.stringify(nodes, null, 2)}

## コード
\`\`\`
${code}
\`\`\`

## 指示
- 各概念ノードに対応するコード部分を抽出してください
- nodeId は元のノードの id を使用してください
- codeSnippet には該当するコード断片を返してください（ファイル名: の接頭辞で示すと分かりやすい）
- explanation にはその部分がなぜその概念に対応するか日本語で説明してください`;
}

function buildEvaluatePrompt(
  node: ConceptNodeData,
  codeSnippet: string,
  userAnswer: string
): string {
  return `あなたはプログラミング学習支援AIです。
ユーザーの理解度を評価してください。

## 概念
タイトル: ${node.title}
説明: ${node.subtitle}

## 対象コード
\`\`\`
${codeSnippet}
\`\`\`

## ユーザーの回答
${userAnswer}

## 指示
- score: 0〜100 の整数で理解度を評価してください
- feedback: 日本語でフィードバックを返してください。良い点と改善点を含めてください
- status: score に基づいて判定してください
  - 70以上: "green"（理解できている）
  - 40以上70未満: "yellow"（部分的に理解）
  - 40未満: "red"（要復習）`;
}

// =============================================================================
// GeminiClient 実装
// =============================================================================

export interface GeminiClient {
  personalizeDescriptions(
    nodes: readonly ConceptNodeData[],
    experienceLevel: ExperienceLevel
  ): Promise<Result<PersonalizedNode[], GeminiError>>;

  generateCode(
    scenario: ScenarioDefinition,
    experienceLevel: ExperienceLevel
  ): Promise<Result<GeneratedCode, GeminiError>>;

  mapConceptsToCode(
    nodes: readonly ConceptNodeData[],
    code: string
  ): Promise<Result<ConceptCodeMapping[], GeminiError>>;

  evaluateUnderstanding(
    node: ConceptNodeData,
    codeSnippet: string,
    userAnswer: string
  ): Promise<Result<EvaluationResult, GeminiError>>;

  askAboutConcept(
    node: ConceptNodeData,
    question: string,
    prompt: string
  ): Promise<Result<string, GeminiError>>;
}

function createGeminiClient(): GeminiClient {
  return {
    async personalizeDescriptions(
      nodes: readonly ConceptNodeData[],
      experienceLevel: ExperienceLevel
    ): Promise<Result<PersonalizedNode[], GeminiError>> {
      const prompt = buildPersonalizePrompt(nodes, experienceLevel);
      return callGeminiAPI<PersonalizedNode[]>(prompt, personalizedNodeSchema);
    },

    async generateCode(
      scenario: ScenarioDefinition,
      experienceLevel: ExperienceLevel
    ): Promise<Result<GeneratedCode, GeminiError>> {
      const prompt = buildGenerateCodePrompt(scenario, experienceLevel);
      return callGeminiAPI<GeneratedCode>(prompt, generatedCodeSchema);
    },

    async mapConceptsToCode(
      nodes: readonly ConceptNodeData[],
      code: string
    ): Promise<Result<ConceptCodeMapping[], GeminiError>> {
      const prompt = buildMapConceptsPrompt(nodes, code);
      return callGeminiAPI<ConceptCodeMapping[]>(
        prompt,
        conceptCodeMappingSchema
      );
    },

    async evaluateUnderstanding(
      node: ConceptNodeData,
      codeSnippet: string,
      userAnswer: string
    ): Promise<Result<EvaluationResult, GeminiError>> {
      const prompt = buildEvaluatePrompt(node, codeSnippet, userAnswer);
      return callGeminiAPI<EvaluationResult>(prompt, evaluationResultSchema);
    },

    async askAboutConcept(
      _node: ConceptNodeData,
      _question: string,
      prompt: string
    ): Promise<Result<string, GeminiError>> {
      const schema = {
        type: 'OBJECT' as const,
        properties: {
          answer: { type: 'STRING' as const },
        },
        required: ['answer'],
      };
      const result = await callGeminiAPI<{ answer: string }>(prompt, schema);
      if (!result.success) return result;
      return { success: true, data: result.data.answer };
    },
  };
}

/** シングルトンの GeminiClient インスタンス */
export const geminiClient: GeminiClient = createGeminiClient();

// テスト用にエクスポート
export { callGeminiAPI, getApiKey };
