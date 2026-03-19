"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ArrowRight } from "lucide-react";

// =============================================================================
// テキスト内のコードブロックをパースして表示
// =============================================================================

function renderMessageText(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      return (
        <pre key={i} className="my-2 bg-black/60 border border-white/10 text-emerald-300 text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed">
          {code}
        </pre>
      );
    }
    // インラインコード
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i} className="whitespace-pre-wrap">
        {inlineParts.map((ip, j) => {
          if (ip.startsWith("`") && ip.endsWith("`")) {
            return <code key={j} className="px-1 py-0.5 bg-white/10 rounded text-emerald-300 text-[11px]">{ip.slice(1, -1)}</code>;
          }
          return ip;
        })}
      </span>
    );
  });
}

// =============================================================================
// 型定義
// =============================================================================

export interface ChatMessage {
  readonly id: string;
  readonly role: "senpai" | "user";
  readonly text: string;
}

interface AnswerPanelProps {
  readonly nodeTitle: string;
  readonly questionText: string;
  readonly isLoadingQuestion?: boolean;
  readonly readOnly?: boolean;
  readonly onSendMessage: (message: string) => Promise<string>;
  readonly onNext?: () => void;
  readonly onBack?: () => void;
  readonly isLast?: boolean;
  readonly isChatting: boolean;
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function AnswerPanel({
  nodeTitle,
  questionText,
  isLoadingQuestion,
  readOnly,
  onSendMessage,
  onNext,
  onBack,
  isLast,
  isChatting,
}: AnswerPanelProps) {
  const [answer, setAnswer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyMapRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const addedQuestionsRef = useRef<Set<string>>(new Set());
  const [, setVersion] = useState(0);

  const messages = historyMapRef.current.get(nodeTitle) ?? [];

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    const current = historyMapRef.current.get(nodeTitle) ?? [];
    historyMapRef.current.set(nodeTitle, updater(current));
    setVersion((v) => v + 1);
  }, [nodeTitle]);

  // 質問が来たらチャットに追加
  useEffect(() => {
    if (!questionText || isLoadingQuestion) return;
    if (addedQuestionsRef.current.has(questionText)) return;
    addedQuestionsRef.current.add(questionText);
    updateMessages((prev) => [
      ...prev,
      { id: `senpai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "senpai", text: questionText },
    ]);
  }, [questionText, isLoadingQuestion, updateMessages]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatting]);

  const handleSubmit = useCallback(async () => {
    const trimmed = answer.trim();
    if (trimmed.length === 0 || isChatting) return;

    // ユーザーメッセージ追加
    updateMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setAnswer("");

    // 先輩の返答を取得
    const reply = await onSendMessage(trimmed);

    // 先輩の返答を追加
    updateMessages((prev) => [
      ...prev,
      { id: `senpai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "senpai", text: reply },
    ]);
  }, [answer, isChatting, onSendMessage, updateMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasConversation = messages.length > 1; // 質問+回答が1往復以上

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* チャットエリア */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "senpai" ? (
                <div className="flex gap-2.5 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm shadow-lg">
                    🧑‍💻
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm border backdrop-blur-sm bg-white/[0.04] border-white/[0.08]">
                    <p className="text-[11px] font-bold text-indigo-400 mb-0.5">先輩</p>
                    <div className="text-[13px] text-gray-200 leading-relaxed">
                      {renderMessageText(msg.text)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-500/15 border border-indigo-500/25">
                  <p className="text-[13px] text-indigo-100 leading-relaxed">{msg.text}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ローディング */}
        {(isLoadingQuestion || isChatting) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm">
              🧑‍💻
            </div>
            <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-gray-400">
                  {isLoadingQuestion ? "先輩が質問を考え中..." : "先輩が返答中..."}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 下部: 入力欄 + 次へボタン */}
      <div className="flex-shrink-0 border-t border-white/10 bg-white/[0.02] px-4 py-3">
        {readOnly ? (
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-gray-300 hover:bg-white/[0.1] transition-colors cursor-pointer"
          >
            現在の問題に戻る
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoadingQuestion ? "先輩が質問を考え中..." : "先輩に返答してみよう..."}
                rows={2}
                disabled={isChatting || isLoadingQuestion}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-colors disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={answer.trim().length === 0 || isChatting || isLoadingQuestion}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer disabled:shadow-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* 次の概念へボタン（1往復以上したら表示） */}
            {hasConversation && !isChatting && (
              <button
                type="button"
                onClick={onNext}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-gray-400 hover:bg-white/[0.08] hover:text-gray-300 transition-colors cursor-pointer"
              >
                {isLast ? "対話を終了する" : "次の概念について話す"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
