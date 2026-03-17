"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";
import ScenarioCard from "@/components/ScenarioCard";
import LevelSelector from "@/components/LevelSelector";
import type { ExperienceLevel, ScenarioSummary, ExperienceLevelDefinition } from "@/types";
import scenariosData from "@/data/scenarios/index.json";
import experienceLevelsData from "@/data/experience-levels.json";

const scenarios: readonly ScenarioSummary[] = scenariosData as ScenarioSummary[];
const experienceLevels: readonly ExperienceLevelDefinition[] =
  experienceLevelsData as ExperienceLevelDefinition[];

export default function Step1Page() {
  const router = useRouter();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel | null>(null);
  const [mode, setMode] = useState<"demo" | "ai">("demo");

  const isReady = selectedScenario !== null && selectedLevel !== null;

  const handleNext = () => {
    if (isReady) {
      router.push(`/step/2?scenario=${selectedScenario}&level=${selectedLevel}&mode=${mode}`);
    }
  };

  return (
    <>
      <StepIndicator currentStep={1} />
      <main className="flex-1 overflow-y-auto py-10 px-4 sm:px-6 relative bg-[#0A0A0B] text-slate-200">
        {/* 背景装飾 */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -z-10 h-[400px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute right-0 bottom-0 -z-10 h-[300px] w-[400px] rounded-full bg-indigo-500/10 blur-[100px]" />
        </div>

        <div className="max-w-3xl mx-auto space-y-12 relative z-10 pt-4">
          {/* シナリオ選択セクション */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-2">
              作りたいアプリを選ぼう
            </h2>
            <p className="text-sm text-gray-400 mb-6 font-medium">
              学習に使うシナリオを1つ選んでください。
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isSelected={selectedScenario === scenario.id}
                  onSelect={setSelectedScenario}
                />
              ))}
            </div>
          </section>

          {/* 経験レベル選択セクション */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-2 pt-4">
              あなたの経験レベルは？
            </h2>
            <p className="text-sm text-gray-400 mb-6 font-medium">
              最も近いものを選んでください。説明の詳しさが変わります。
            </p>
            <LevelSelector
              levels={experienceLevels}
              selectedLevel={selectedLevel}
              onSelect={setSelectedLevel}
            />
          </section>

          {/* モード選択 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-2 pt-4">
              コード生成モード
            </h2>
            <p className="text-sm text-gray-400 mb-6 font-medium">
              デモモードは用意済みのコードを使います（無料）。AIモードはGeminiがコードを生成します。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("demo")}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  mode === "demo"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚡</span>
                  <span className={`text-sm font-bold ${mode === "demo" ? "text-emerald-400" : "text-gray-300"}`}>
                    デモモード
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  すぐに体験できる。API不要・無料。
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  mode === "ai"
                    ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🤖</span>
                  <span className={`text-sm font-bold ${mode === "ai" ? "text-indigo-400" : "text-gray-300"}`}>
                    AIモード
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Gemini AIがあなた専用のコードを生成。
                </p>
              </button>
            </div>
          </section>

          {/* 次へボタン */}
          <div className="flex justify-center pb-4">
            <button
              type="button"
              disabled={!isReady}
              onClick={handleNext}
              className={[
                "px-10 py-4 rounded-xl text-lg font-bold transition-all duration-300",
                isReady
                  ? "bg-gradient-to-r from-emerald-400 to-indigo-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] cursor-pointer hover:scale-[1.02]"
                  : "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10",
              ].join(" ")}
            >
              ロードマップを見る
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
