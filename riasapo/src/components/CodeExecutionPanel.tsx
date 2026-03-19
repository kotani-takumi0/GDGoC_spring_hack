'use client';

import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

// =============================================================================
// 型定義
// =============================================================================

interface CodeExecutionPanelProps {
  readonly conceptTitle: string;
  readonly codeSnippet: string;
  readonly explanation: string;
}

interface ExecutionResult {
  readonly code: string;
  readonly output: string;
  readonly outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | 'OUTCOME_DEADLINE_EXCEEDED';
  readonly explanation: string;
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function CodeExecutionPanel({
  conceptTitle,
  codeSnippet,
  explanation,
}: CodeExecutionPanelProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptTitle, codeSnippet, explanation }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'コード実行に失敗しました');
        return;
      }

      setResult(data);
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsExecuting(false);
    }
  }, [conceptTitle, codeSnippet, explanation]);

  const outcomeIcon = result?.outcome === 'OUTCOME_OK'
    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
    : result?.outcome === 'OUTCOME_DEADLINE_EXCEEDED'
    ? <Clock className="w-4 h-4 text-amber-400" />
    : <XCircle className="w-4 h-4 text-red-400" />;

  const outcomeLabel = result?.outcome === 'OUTCOME_OK'
    ? '実行成功'
    : result?.outcome === 'OUTCOME_DEADLINE_EXCEEDED'
    ? 'タイムアウト'
    : '実行エラー';

  return (
    <div className="mt-3">
      <button
        onClick={handleExecute}
        disabled={isExecuting}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {isExecuting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {isExecuting ? '実行中...' : '実行して確認'}
      </button>

      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-2 space-y-2">
          {/* ステータス */}
          <div className="flex items-center gap-1.5">
            {outcomeIcon}
            <span className="text-xs font-medium text-gray-300">{outcomeLabel}</span>
          </div>

          {/* 実行されたPythonコード */}
          {result.code && (
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-gray-500 mb-1">Python変換コード:</p>
              <pre className="text-[11px] text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
                {result.code}
              </pre>
            </div>
          )}

          {/* 実行結果 */}
          {result.output && (
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] text-emerald-500/70 mb-1">実行結果:</p>
              <pre className="text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono">
                {result.output}
              </pre>
            </div>
          )}

          {/* AI解説 */}
          {result.explanation && (
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-gray-500 mb-1">解説:</p>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                {result.explanation.length > 500 ? `${result.explanation.slice(0, 500)}...` : result.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
