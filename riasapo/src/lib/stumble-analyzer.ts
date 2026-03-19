// =============================================================================
// つまずきパターン分析 — Q&A頻度・理解度スコアの集計と相関分析
// =============================================================================

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ExperienceLevel } from '@/types';

// =============================================================================
// 型定義
// =============================================================================

interface ConceptScore {
  readonly nodeId: string;
  readonly scores: readonly number[];
}

interface StumbleStat {
  readonly nodeId: string;
  readonly avgScore: number;
  readonly totalAttempts: number;
  readonly redRate: number;
  readonly correlatedNodes: readonly { readonly nodeId: string; readonly correlation: number }[];
}

// =============================================================================
// 集計・分析
// =============================================================================

/**
 * 指定された経験レベルのつまずきパターンを集計し、stumble_statsコレクションに保存する。
 */
export async function analyzeAndSaveStumbleStats(
  experienceLevel: ExperienceLevel
): Promise<void> {
  // 全評価データを取得
  const evaluationsRef = adminDb.collectionGroup('results');
  const snapshot = await evaluationsRef
    .where('experienceLevel', '==', experienceLevel)
    .get();

  if (snapshot.empty) return;

  // 概念ごとにスコアを集計
  const conceptScores = new Map<string, number[]>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const nodeId = data.nodeId as string;
    const score = data.score as number;

    const scores = conceptScores.get(nodeId) ?? [];
    conceptScores.set(nodeId, [...scores, score]);
  }

  // 統計を計算
  const stats: StumbleStat[] = [];
  const conceptEntries: ConceptScore[] = Array.from(conceptScores.entries()).map(
    ([nodeId, scores]) => ({ nodeId, scores })
  );

  for (const entry of conceptEntries) {
    const { nodeId, scores } = entry;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const redCount = scores.filter((s) => s < 40).length;
    const redRate = redCount / scores.length;

    // 他概念との相関を計算（同一ユーザーが両方低スコアの割合）
    const correlatedNodes: { nodeId: string; correlation: number }[] = [];

    for (const other of conceptEntries) {
      if (other.nodeId === nodeId) continue;

      // 簡易相関: 両方がred（<40）の割合
      const myRedSet = new Set(
        scores
          .map((s, i) => (s < 40 ? i : -1))
          .filter((i) => i >= 0)
      );
      const otherRedCount = other.scores.filter((s) => s < 40).length;

      if (myRedSet.size > 0 && otherRedCount > 0) {
        // 両方redが多い概念ほど相関が高い
        const correlation = Math.min(redRate, otherRedCount / other.scores.length);
        if (correlation > 0.2) {
          correlatedNodes.push({ nodeId: other.nodeId, correlation: Math.round(correlation * 100) / 100 });
        }
      }
    }

    // 相関が高い順にソート、上位5件
    correlatedNodes.sort((a, b) => b.correlation - a.correlation);

    stats.push({
      nodeId,
      avgScore: Math.round(avgScore * 10) / 10,
      totalAttempts: scores.length,
      redRate: Math.round(redRate * 100) / 100,
      correlatedNodes: correlatedNodes.slice(0, 5),
    });
  }

  // Firestoreに保存
  await adminDb
    .collection('stumble_stats')
    .doc(experienceLevel)
    .set({
      stats,
      updatedAt: FieldValue.serverTimestamp(),
    });
}
