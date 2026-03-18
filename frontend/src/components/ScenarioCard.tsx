"use client";

import type { ScenarioSummary } from "@/types";

interface ScenarioCardProps {
  readonly scenario: ScenarioSummary;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

function CheckIcon() {
  return (
    <svg
      className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white/5 text-gray-400 border border-white/10 backdrop-blur-sm">
      Coming Soon
    </span>
  );
}

export default function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
}: ScenarioCardProps) {
  const isAvailable = scenario.available;

  const cardClass = [
    "relative rounded-2xl border p-6 transition-all duration-300 backdrop-blur-md",
    isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-40 hover:opacity-40",
    isSelected
      ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] scale-[1.01]"
      : isAvailable
        ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
        : "border-white/5 bg-black/50 text-gray-500",
  ].join(" ");

  const handleClick = () => {
    if (isAvailable) {
      onSelect(scenario.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isAvailable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect(scenario.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isAvailable ? 0 : -1}
      aria-disabled={!isAvailable}
      aria-pressed={isSelected}
      className={cardClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
            {scenario.title}
          </h3>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed font-medium">
            {scenario.description}
          </p>
        </div>
        <div className="flex-shrink-0 pt-0.5">
          {!isAvailable && <ComingSoonBadge />}
          {isSelected && <CheckIcon />}
        </div>
      </div>
    </div>
  );
}
