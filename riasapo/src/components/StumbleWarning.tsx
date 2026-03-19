'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

// =============================================================================
// 型定義
// =============================================================================

interface StumbleStat {
  readonly nodeId: string;
  readonly avgScore: number;
  readonly totalAttempts: number;
  readonly redRate: number;
  readonly correlatedNodes: readonly { readonly nodeId: string; readonly correlation: number }[];
}

interface StumbleWarningProps {
  readonly nodeId: string;
  readonly experienceLevel: string;
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function StumbleWarning({ nodeId, experienceLevel }: StumbleWarningProps) {
  const [stat, setStat] = useState<StumbleStat | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/stumble-stats?level=${experienceLevel}`);
        if (!res.ok) return;
        const data = await res.json();
        const stats = data.stats as StumbleStat[] | undefined;
        const found = stats?.find((s) => s.nodeId === nodeId);
        setStat(found ?? null);
      } catch {
        // 取得失敗は無視
      }
    }
    fetchStats();
  }, [nodeId, experienceLevel]);

  // データなし or red率が低い場合は表示しない
  if (!stat || stat.redRate < 0.3 || stat.totalAttempts < 3) return null;

  const relatedWarnings = stat.correlatedNodes
    .filter((c) => c.correlation > 0.3)
    .slice(0, 2);

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
          つまずきやすい概念
        </span>
      </div>
      <p className="text-[11px] text-amber-200/70 leading-relaxed">
        この概念は{Math.round(stat.redRate * 100)}%の学習者が理解に苦戦しています（{stat.totalAttempts}人中）
      </p>
      {relatedWarnings.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1">
          関連注意: {relatedWarnings.map((c) => c.nodeId).join('、')}も要チェック
        </p>
      )}
    </div>
  );
}
