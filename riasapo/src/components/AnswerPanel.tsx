"use client";

import { useState, useCallback } from "react";

// =============================================================================
// AnswerPanel — 回答入力・フィードバック表示コンポーネント
// =============================================================================

interface AnswerPanelProps {
  readonly nodeTitle: string;
  readonly codeSnippet: string;
  readonly onSubmit: (answer: string) => void;
  readonly isEvaluating: boolean;
  readonly feedback?: string;
  readonly status?: "green" | "yellow" | "red";
}

const STATUS_CONFIG = {
  green: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    label: "理解できています",
    icon: "✓",
  },
  yellow: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    label: "部分的に理解",
    icon: "△",
  },
  red: {
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-400",
    label: "もう少し復習しましょう",
    icon: "×",
  },
} as const;

export default function AnswerPanel({
  nodeTitle,
  codeSnippet,
  onSubmit,
  isEvaluating,
  feedback,
  status,
}: AnswerPanelProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = useCallback(() => {
    if (answer.trim().length === 0 || isEvaluating) return;
    onSubmit(answer.trim());
    setAnswer("");
  }, [answer, isEvaluating, onSubmit]);

  const isSubmitDisabled = answer.trim().length === 0 || isEvaluating;

  return (
    <div className="flex flex-col gap-5">
      {/* ノードタイトル */}
      <h3 className="text-xl font-bold text-white tracking-wide">{nodeTitle}</h3>

      {/* 対応コード箇所 */}
      <div>
        <p className="text-sm font-bold text-gray-400 mb-2 tracking-wide">
          対応するコード:
        </p>
        <pre className="bg-black/60 border border-white/10 text-emerald-300 text-sm p-4 rounded-xl overflow-x-auto leading-relaxed custom-scrollbar shadow-inner">
          {codeSnippet}
        </pre>
      </div>

      {/* 質問文 */}
      <div>
        <p className="text-sm font-bold text-gray-300 mb-2 tracking-wide">
          このコードが何をしているか、自分の言葉で説明してください
        </p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="例: この部分は、新しいタスクを配列に追加している..."
          rows={5}
          disabled={isEvaluating}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-black/20 disabled:text-gray-600 transition-all custom-scrollbar"
        />
      </div>

      {/* 回答ボタン */}
      <button
        type="button"
        disabled={isSubmitDisabled}
        onClick={handleSubmit}
        className={[
          "px-8 py-3 rounded-xl text-sm font-bold transition-all self-start duration-300",
          isSubmitDisabled
            ? "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
            : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] cursor-pointer hover:scale-[1.02]",
        ].join(" ")}
      >
        {isEvaluating ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
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
            評価中...
          </span>
        ) : (
          "回答する"
        )}
      </button>

      {/* フィードバック表示 */}
      {status && feedback && (
        <div
          className={`border rounded-lg p-4 ${STATUS_CONFIG[status].bg}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-bold ${STATUS_CONFIG[status].text}`}>
              {STATUS_CONFIG[status].icon}
            </span>
            <span
              className={`text-sm font-semibold ${STATUS_CONFIG[status].text}`}
            >
              {STATUS_CONFIG[status].label}
            </span>
          </div>
          <p className={`text-sm ${STATUS_CONFIG[status].text}`}>
            {feedback}
          </p>
        </div>
      )}
    </div>
  );
}
