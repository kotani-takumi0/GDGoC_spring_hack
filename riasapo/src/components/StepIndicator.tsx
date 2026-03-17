"use client";

const STEPS = [
  { id: 1, label: "選択" },
  { id: 2, label: "ロードマップ" },
  { id: 3, label: "コード生成" },
  { id: 4, label: "マッピング" },
  { id: 5, label: "理解度チェック" },
] as const;

type StepId = 1 | 2 | 3 | 4 | 5;

interface StepIndicatorProps {
  readonly currentStep: StepId;
}

function StepCircle({
  step,
  currentStep,
}: {
  readonly step: (typeof STEPS)[number];
  readonly currentStep: StepId;
}) {
  const isCompleted = step.id < currentStep;
  const isCurrent = step.id === currentStep;

  const circleClass = isCompleted
    ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400/50"
    : isCurrent
      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] ring-2 ring-indigo-400/30 border border-white/20"
      : "bg-white/5 text-gray-400 border border-white/10";

  const labelClass = isCurrent
    ? "text-indigo-300 font-bold"
    : isCompleted
      ? "text-indigo-400/80 font-medium"
      : "text-gray-500";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${circleClass}`}
      >
        {isCompleted ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          step.id
        )}
      </div>
      <span className={`text-xs tracking-wider mt-1 whitespace-nowrap ${labelClass}`}>
        {step.label}
      </span>
    </div>
  );
}

function Connector({ isCompleted }: { readonly isCompleted: boolean }) {
  return (
    <div
      className={`flex-1 h-0.5 mt-[18px] mx-2 rounded-full transition-colors duration-500 ${isCompleted ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "bg-white/10"}`}
    />
  );
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav className="bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/10 py-5 px-6 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex items-start justify-between relative">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start ${index === 0 ? "" : "flex-1"}`}
          >
            {index > 0 && <Connector isCompleted={step.id <= currentStep} />}
            <StepCircle step={step} currentStep={currentStep} />
          </div>
        ))}
      </div>
    </nav>
  );
}
