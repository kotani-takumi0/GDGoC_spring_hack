import { notFound } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";

const VALID_STEPS = [1, 2, 3, 4, 5] as const;
type StepId = (typeof VALID_STEPS)[number];

const STEP_TITLES: Record<StepId, string> = {
  1: "選択",
  2: "ロードマップ",
  3: "コード生成",
  4: "マッピング",
  5: "理解度チェック",
};

function isValidStep(value: number): value is StepId {
  return VALID_STEPS.includes(value as StepId);
}

interface StepPageProps {
  readonly params: Promise<{ stepId: string }>;
}

export default async function StepPage({ params }: StepPageProps) {
  const { stepId: stepIdParam } = await params;
  const stepNumber = Number(stepIdParam);

  if (!isValidStep(stepNumber)) {
    notFound();
  }

  return (
    <>
      <StepIndicator currentStep={stepNumber} />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-3xl w-full bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            ステップ {stepNumber}: {STEP_TITLES[stepNumber]}
          </h1>
          <p className="text-gray-500">
            このページは準備中です。
          </p>
        </div>
      </main>
    </>
  );
}
