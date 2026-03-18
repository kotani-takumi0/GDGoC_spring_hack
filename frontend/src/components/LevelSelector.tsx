"use client";

import { Cpu, Zap } from "lucide-react";
import type { ExperienceLevel, ExperienceLevelDefinition } from "@/types";

interface LevelSelectorProps {
  readonly levels: readonly ExperienceLevelDefinition[];
  readonly selectedLevel: ExperienceLevel | null;
  readonly onSelect: (level: ExperienceLevel) => void;
  readonly useLocalLLM: boolean;
  readonly onToggleLocalLLM: (enabled: boolean) => void;
}

interface LevelCardProps {
  readonly level: ExperienceLevelDefinition;
  readonly isSelected: boolean;
  readonly onSelect: (level: ExperienceLevel) => void;
}

function LevelCard({ level, isSelected, onSelect }: LevelCardProps) {
  const cardClass = [
    "rounded-2xl border p-5 transition-all duration-300 cursor-pointer backdrop-blur-md",
    isSelected
      ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-[1.01]"
      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
  ].join(" ");

  const handleClick = () => {
    onSelect(level.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(level.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cardClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all",
            isSelected
              ? "border-indigo-500 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              : "border-white/20 bg-transparent",
          ].join(" ")}
        >
          {isSelected && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
            {level.label}
          </h3>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed font-medium">
            {level.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LevelSelector({
  levels,
  selectedLevel,
  onSelect,
  useLocalLLM,
  onToggleLocalLLM,
}: LevelSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {levels.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            isSelected={selectedLevel === level.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* ローカルLLM切替スイッチ */}
      <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${useLocalLLM ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
              <Cpu size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                ローカル LLM を使用
                {useLocalLLM && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-tighter">Gemma 3</span>}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                オフライン・高速・高セキュアな Gemma 3 を使用します
              </p>
            </div>
          </div>
          
          <button
            onClick={() => onToggleLocalLLM(!useLocalLLM)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              useLocalLLM ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`${
                useLocalLLM ? "translate-x-6" : "translate-x-1"
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
