"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2 } from "lucide-react";

// =============================================================================
// 型定義
// =============================================================================

interface QAEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly timestamp: number;
}

interface ConceptQAProps {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly nodeSubtitle: string;
  readonly scenarioTitle: string;
  readonly experienceLevel: string;
}

// =============================================================================
// localStorage永続化
// =============================================================================

const STORAGE_KEY = "riasapo-qa-history";

function loadHistory(): Record<string, QAEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveHistory(history: Record<string, QAEntry[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // quota exceeded等は無視
  }
}

function getNodeHistory(nodeId: string): QAEntry[] {
  const all = loadHistory();
  return all[nodeId] ?? [];
}

function addToHistory(nodeId: string, entry: QAEntry) {
  const all = loadHistory();
  const nodeEntries = all[nodeId] ?? [];
  const updated = { ...all, [nodeId]: [...nodeEntries, entry] };
  saveHistory(updated);
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function ConceptQA({
  nodeId,
  nodeTitle,
  nodeSubtitle,
  scenarioTitle,
  experienceLevel,
}: ConceptQAProps) {
  const searchParams = useSearchParams();
  const useLocalLLM = searchParams.get("useLocalLLM") === "true";

  const [history, setHistory] = useState<QAEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // nodeId変更時に履歴を読み込み
  useEffect(() => {
    setHistory(getNodeHistory(nodeId));
    setQuestion("");
  }, [nodeId]);

  // 新しい回答が追加されたらスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setQuestion("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          nodeTitle,
          nodeSubtitle,
          question: q,
          scenarioTitle,
          experienceLevel,
          useLocalLLM,
        }),
      });

      const data = await response.json();
      const answer = data.answer ?? data.error ?? "回答を取得できませんでした";

      const entry: QAEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question: q,
        answer,
        timestamp: Date.now(),
      };

      addToHistory(nodeId, entry);
      setHistory((prev) => [...prev, entry]);
    } catch {
      const entry: QAEntry = {
        id: `${Date.now()}-err`,
        question: q,
        answer: "ネットワークエラーが発生しました。もう一度お試しください。",
        timestamp: Date.now(),
      };
      addToHistory(nodeId, entry);
      setHistory((prev) => [...prev, entry]);
    } finally {
      setIsAsking(false);
    }
  }, [question, isAsking, nodeId, nodeTitle, nodeSubtitle, scenarioTitle, experienceLevel, useLocalLLM]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-6 border-t border-white/5 pt-5"
    >
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5" />
        AIに質問する
      </h4>

      {/* 履歴 */}
      {history.length > 0 && (
        <div
          ref={scrollRef}
          className="max-h-[240px] overflow-y-auto space-y-3 mb-3 custom-scrollbar"
        >
          <AnimatePresence>
            {history.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                {/* 質問 */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-sm bg-indigo-500/20 border border-indigo-500/20">
                    <p className="text-xs text-indigo-200 leading-relaxed">{entry.question}</p>
                  </div>
                </div>
                {/* 回答 */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{entry.answer}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ローディング */}
      {isAsking && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          <span className="text-xs text-gray-500">回答を生成中...</span>
        </div>
      )}

      {/* 入力欄 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`「${nodeTitle}」について質問...`}
          disabled={isAsking}
          className="flex-1 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={isAsking || !question.trim()}
          className="px-3 py-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
