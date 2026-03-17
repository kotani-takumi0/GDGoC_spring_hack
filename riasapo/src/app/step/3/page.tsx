"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";
import { TODO_APP_DEMO } from "@/data/demo-code/todo-app";

// =============================================================================
// 型定義
// =============================================================================

interface GeneratedFile {
  readonly filename: string;
  readonly code: string;
  readonly description: string;
}

interface GenerateCodeResult {
  readonly files: readonly GeneratedFile[];
  readonly language: string;
  readonly explanation: string;
}

type PageState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "navigating" };

// =============================================================================
// シナリオ表示名マッピング
// =============================================================================

const SCENARIO_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "todo-app": "Todoアプリ",
  calculator: "電卓アプリ",
  "weather-app": "天気予報アプリ",
  "chat-app": "チャットアプリ",
};

function getScenarioDisplayName(scenarioId: string): string {
  return SCENARIO_DISPLAY_NAMES[scenarioId] ?? scenarioId;
}

// =============================================================================
// 背景装飾コンポーネント
// =============================================================================

function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.06]"
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 中央ノード */}
        <circle cx="300" cy="300" r="40" stroke="#6B7280" strokeWidth="2" />
        <circle cx="300" cy="300" r="8" fill="#6B7280" />

        {/* 上ノード */}
        <circle cx="300" cy="140" r="28" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="300"
          y1="260"
          x2="300"
          y2="168"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 右上ノード */}
        <circle cx="440" cy="190" r="24" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="335"
          y1="272"
          x2="420"
          y2="208"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 右下ノード */}
        <circle cx="460" cy="360" r="30" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="340"
          y1="310"
          x2="430"
          y2="350"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 下ノード */}
        <circle cx="300" cy="470" r="26" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="300"
          y1="340"
          x2="300"
          y2="444"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 左下ノード */}
        <circle cx="150" cy="400" r="22" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="265"
          y1="325"
          x2="170"
          y2="388"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 左上ノード */}
        <circle cx="160" cy="210" r="26" stroke="#6B7280" strokeWidth="1.5" />
        <line
          x1="265"
          y1="280"
          x2="184"
          y2="226"
          stroke="#6B7280"
          strokeWidth="1.5"
        />

        {/* 追加の接続線（ノード間） */}
        <line
          x1="300"
          y1="140"
          x2="440"
          y2="190"
          stroke="#6B7280"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="150"
          y1="400"
          x2="300"
          y2="470"
          stroke="#6B7280"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="160"
          y1="210"
          x2="300"
          y2="140"
          stroke="#6B7280"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
}

// =============================================================================
// ローディング表示コンポーネント
// =============================================================================

function LoadingView({ scenarioName }: { readonly scenarioName: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* パルスアニメーション */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full bg-indigo-500 animate-ping opacity-20" />
        <div className="absolute w-20 h-20 rounded-full bg-purple-500 animate-pulse opacity-30" />
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)]">
          <svg
            className="w-7 h-7 text-white animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>

      {/* テキスト */}
      <div className="text-center space-y-3 z-10">
        <p className="text-xl font-bold text-white tracking-wide">
          AIが{scenarioName}のコードを生成しています...
        </p>
        <p className="text-sm text-indigo-300/80 font-medium">
          少々お待ちください（10〜30秒程度）
        </p>
      </div>

      {/* プログレスバー風アニメーション */}
      <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full animate-pulse w-2/3 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
      </div>
    </div>
  );
}

// =============================================================================
// エラー表示コンポーネント
// =============================================================================

function ErrorView({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* エラーアイコン */}
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          className="w-7 h-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* エラーメッセージ */}
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold text-gray-700">
          コード生成に失敗しました
        </p>
        <p className="text-sm text-red-500">{message}</p>
      </div>

      {/* リトライボタン */}
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
      >
        リトライ
      </button>
    </div>
  );
}

// =============================================================================
// コード生成API呼び出し
// =============================================================================

async function callGenerateCodeApi(
  scenarioId: string,
  experienceLevel: string
): Promise<GenerateCodeResult> {
  const response = await fetch("/api/generate-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId, experienceLevel }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage =
      (errorBody as { error?: string } | null)?.error ??
      "コード生成中にエラーが発生しました。";
    throw new Error(errorMessage);
  }

  const data: GenerateCodeResult = await response.json();
  return data;
}

// =============================================================================
// メインページコンポーネント
// =============================================================================

function Step3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const scenarioId = searchParams.get("scenario") ?? "";
  const level = searchParams.get("level") ?? "";
  const mode = searchParams.get("mode") ?? "demo";
  const scenarioName = getScenarioDisplayName(scenarioId);

  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const hasStartedRef = useRef(false);

  const generateCode = useCallback(async () => {
    if (!scenarioId || !level) {
      setPageState({
        status: "error",
        message: "シナリオまたは経験レベルが指定されていません。",
      });
      return;
    }

    setPageState({ status: "loading" });

    // デモモード: 常にプリセットコードを使用（キャッシュも上書き）
    const demoData = mode === "demo" && scenarioId === "todo-app" ? TODO_APP_DEMO : null;
    if (demoData) {
      console.log("[Step3] デモモード: プリセットコードを使用（API呼び出しスキップ）");
      sessionStorage.setItem(
        "riasapo-generated-code",
        JSON.stringify({
          files: demoData.files,
          language: demoData.language,
          explanation: demoData.explanation,
          scenarioId,
          level,
        })
      );
      setPageState({ status: "navigating" });
      router.push(`/step/4?scenario=${scenarioId}&level=${level}&mode=${mode}`);
      return;
    }

    // AIモード: キャッシュチェック
    try {
      const cached = sessionStorage.getItem("riasapo-generated-code");
      if (cached) {
        const parsed = JSON.parse(cached) as { files?: unknown; scenarioId?: string; level?: string };
        if (parsed.scenarioId === scenarioId && parsed.level === level && Array.isArray(parsed.files) && parsed.files.length > 0) {
          console.log("[Step3] AIモード: キャッシュ済みコードを使用");
          setPageState({ status: "navigating" });
          router.push(`/step/4?scenario=${scenarioId}&level=${level}&mode=${mode}`);
          return;
        }
      }
    } catch { /* ignore */ }

    try {
      const result = await callGenerateCodeApi(scenarioId, level);

      sessionStorage.setItem(
        "riasapo-generated-code",
        JSON.stringify({
          files: result.files,
          language: result.language,
          explanation: result.explanation,
          scenarioId,
          level,
        })
      );

      setPageState({ status: "navigating" });
      router.push(`/step/4?scenario=${scenarioId}&level=${level}&mode=${mode}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "予期しないエラーが発生しました。";
      setPageState({ status: "error", message });
    }
  }, [scenarioId, level, mode, router]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const timer = window.setTimeout(() => {
      void generateCode();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [generateCode]);

  const handleRetry = () => {
    generateCode();
  };

  return (
    <>
      <StepIndicator currentStep={3} />
      <main className="flex-1 flex items-center justify-center p-8 relative overflow-hidden bg-[#0A0A0B] text-slate-200">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] z-0" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-indigo-500 opacity-20 blur-[100px]" />

        <BackgroundDecoration />

        <div className="relative z-10">
          {pageState.status === "loading" || pageState.status === "navigating" ? (
            <LoadingView scenarioName={scenarioName} />
          ) : (
            <ErrorView message={pageState.message} onRetry={handleRetry} />
          )}
        </div>
      </main>
    </>
  );
}

export default function Step3Page() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <Step3Content />
    </Suspense>
  );
}
