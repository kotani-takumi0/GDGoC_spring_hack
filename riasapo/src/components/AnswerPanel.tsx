"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2 } from "lucide-react";

// =============================================================================
// テキスト内のコードブロックをパースして表示
// =============================================================================

function renderMessageText(text: string) {
  // ```...``` で囲まれた部分をコードブロックとして表示
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      // コードブロック: ``` と言語名を除去
      const code = part
        .replace(/^```\w*\n?/, "")
        .replace(/\n?```$/, "");
      return (
        <pre
          key={i}
          className="my-2 bg-black/60 border border-white/10 text-emerald-300 text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed"
        >
          {code}
        </pre>
      );
    }
    // 通常テキスト
    if (part.trim() === "") return null;
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    );
  });
}

// =============================================================================
// 型定義
// =============================================================================

interface ChatMessage {
  readonly id: string;
  readonly role: "senpai" | "user";
  readonly text: string;
  readonly status?: "green" | "yellow" | "red";
}

interface AnswerPanelProps {
  readonly nodeTitle: string;
  readonly codeSnippet: string;
  readonly questionText: string;
  readonly onSubmit: (answer: string) => void;
  readonly isEvaluating: boolean;
  readonly feedback?: string;
  readonly status?: "green" | "yellow" | "red";
}

// =============================================================================
// 先輩のリアクション
// =============================================================================

const SENPAI_REACTIONS = {
  green: [
    "お、いいね！ちゃんと分かってるじゃん👏",
    "うんうん、その理解で合ってる！いい感じ💪",
    "おー、しっかり説明できてるね！次いこ！✨",
  ],
  yellow: [
    "うーん、惜しい！もうちょい深掘りできそう🤔",
    "方向性はいいんだけど、もう少し具体的に言えるかな？",
    "なるほどね〜、半分くらい合ってる。もう一歩！",
  ],
  red: [
    "ちょっと待って、それだと違うかも😅 もう一回コード見てみ？",
    "んー、ちょっとズレてるかな。ヒント出そうか？",
    "あー、そこ引っかかるよね。ポイントはそこじゃなくて...",
  ],
} as const;

function getRandomReaction(status: "green" | "yellow" | "red"): string {
  const reactions = SENPAI_REACTIONS[status];
  return reactions[Math.floor(Math.random() * reactions.length)];
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function AnswerPanel({
  nodeTitle,
  codeSnippet,
  questionText,
  onSubmit,
  isEvaluating,
  feedback,
  status,
}: AnswerPanelProps) {
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prevNodeTitle, setPrevNodeTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ノードが変わったら先輩の質問を追加
  useEffect(() => {
    if (nodeTitle && nodeTitle !== prevNodeTitle) {
      setPrevNodeTitle(nodeTitle);
      setMessages((prev) => {
        // 同じ質問が既に追加されていたら重複しない
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "senpai" && lastMsg.text === questionText) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `senpai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: "senpai",
            text: questionText,
          },
        ];
      });
    }
  }, [nodeTitle, questionText, prevNodeTitle]);

  // フィードバックが来たら先輩のリアクションを追加
  useEffect(() => {
    if (status && feedback) {
      const reaction = getRandomReaction(status);
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "senpai" && lastMsg.status === status && lastMsg.text.includes(feedback)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: "senpai",
            text: `${reaction}\n\n${feedback}`,
            status,
          },
        ];
      });
    }
  }, [status, feedback]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isEvaluating]);

  const handleSubmit = useCallback(() => {
    const trimmed = answer.trim();
    if (trimmed.length === 0 || isEvaluating) return;

    // ユーザーの回答をチャットに追加
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
      },
    ]);

    onSubmit(trimmed);
    setAnswer("");
  }, [answer, isEvaluating, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const statusBorder = status === "green"
    ? "border-emerald-500/30"
    : status === "yellow"
    ? "border-amber-500/30"
    : status === "red"
    ? "border-red-500/30"
    : "border-white/10";

  return (
    <div className="flex flex-col h-full">
      {/* チャットエリア */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar"
      >
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
                  {/* 先輩アバター */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm shadow-lg">
                    🧑‍💻
                  </div>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl rounded-tl-sm border backdrop-blur-sm ${
                      msg.status
                        ? msg.status === "green"
                          ? "bg-emerald-500/8 border-emerald-500/20"
                          : msg.status === "yellow"
                          ? "bg-amber-500/8 border-amber-500/20"
                          : "bg-red-500/8 border-red-500/20"
                        : "bg-white/[0.04] border-white/[0.08]"
                    }`}
                  >
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

        {/* 評価中のインジケータ */}
        {isEvaluating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2.5"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm">
              🧑‍💻
            </div>
            <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-gray-400">先輩が考え中...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 入力欄 */}
      <div className={`flex-shrink-0 border-t ${statusBorder} bg-white/[0.02] px-4 py-3`}>
        <div className="flex gap-2 items-end">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="自分の言葉で説明してみよう..."
            rows={2}
            disabled={isEvaluating}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-colors disabled:opacity-40"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={answer.trim().length === 0 || isEvaluating}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
