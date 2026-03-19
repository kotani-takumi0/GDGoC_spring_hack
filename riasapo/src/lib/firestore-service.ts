// =============================================================================
// Firestore サービス — データ永続化・ベクトル検索・理解度保存
// =============================================================================

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { ExperienceLevel } from '@/types';
import type { Result, GeminiError } from '@/lib/gemini-client';

// =============================================================================
// 型定義
// =============================================================================

export interface SessionData {
  readonly scenarioId: string;
  readonly experienceLevel: ExperienceLevel;
  readonly mode: 'demo' | 'ai';
  readonly currentStep: number;
  readonly generatedCode: {
    readonly files: readonly { readonly filename: string; readonly code: string; readonly description: string }[];
    readonly language: string;
    readonly explanation: string;
  } | null;
  readonly mappings: readonly { readonly nodeId: string; readonly codeSnippet: string; readonly explanation: string }[] | null;
}

export interface QALogEntry {
  readonly userId: string | null;
  readonly nodeId: string;
  readonly scenarioId: string;
  readonly experienceLevel: ExperienceLevel;
  readonly question: string;
  readonly answer: string;
  readonly embedding?: readonly number[];
}

export interface EvaluationEntry {
  readonly nodeId: string;
  readonly scenarioId: string;
  readonly score: number;
  readonly status: 'green' | 'yellow' | 'red';
  readonly feedback: string;
  readonly experienceLevel: ExperienceLevel;
}

export interface StumbleStat {
  readonly nodeId: string;
  readonly avgScore: number;
  readonly totalAttempts: number;
  readonly redRate: number;
  readonly correlatedNodes: readonly { readonly nodeId: string; readonly correlation: number }[];
}

interface FirestoreError {
  readonly message: string;
  readonly code: string;
}

// =============================================================================
// ヘルパー
// =============================================================================

function createError<T>(message: string, code: string): Result<T, FirestoreError> {
  return { success: false, error: { message, code } };
}

function createSuccess<T>(data: T): Result<T, FirestoreError> {
  return { success: true, data };
}

// =============================================================================
// ユーザー
// =============================================================================

export async function saveUser(uid: string, profile: {
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly email: string | null;
}): Promise<Result<void, FirestoreError>> {
  try {
    await adminDb.collection('users').doc(uid).set({
      uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      email: profile.email,
      lastActiveAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return createSuccess(undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ユーザー保存に失敗しました';
    return createError(msg, 'FIRESTORE_WRITE_ERROR');
  }
}

// =============================================================================
// セッション
// =============================================================================

export async function saveSession(
  userId: string,
  data: SessionData
): Promise<Result<void, FirestoreError>> {
  try {
    await adminDb.collection('sessions').doc(userId).set({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return createSuccess(undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'セッション保存に失敗しました';
    return createError(msg, 'FIRESTORE_WRITE_ERROR');
  }
}

export async function loadSession(
  userId: string
): Promise<Result<SessionData | null, FirestoreError>> {
  try {
    const doc = await adminDb.collection('sessions').doc(userId).get();
    if (!doc.exists) {
      return createSuccess(null);
    }
    const data = doc.data() as SessionData;
    return createSuccess(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'セッション読み込みに失敗しました';
    return createError(msg, 'FIRESTORE_READ_ERROR');
  }
}

// =============================================================================
// Q&Aログ
// =============================================================================

export async function saveQALog(
  entry: QALogEntry
): Promise<Result<string, FirestoreError>> {
  try {
    const docData: Record<string, unknown> = {
      userId: entry.userId,
      nodeId: entry.nodeId,
      scenarioId: entry.scenarioId,
      experienceLevel: entry.experienceLevel,
      question: entry.question,
      answer: entry.answer,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (entry.embedding) {
      docData.embedding = FieldValue.vector(entry.embedding as number[]);
    }

    const ref = await adminDb.collection('qa_logs').add(docData);
    return createSuccess(ref.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Q&Aログ保存に失敗しました';
    return createError(msg, 'FIRESTORE_WRITE_ERROR');
  }
}

export async function findSimilarQA(
  queryVector: readonly number[],
  nodeId: string,
  limit: number
): Promise<Result<readonly QALogEntry[], FirestoreError>> {
  try {
    const coll = adminDb.collection('qa_logs');
    const query = coll
      .where('nodeId', '==', nodeId)
      .findNearest({
        vectorField: 'embedding',
        queryVector: queryVector as number[],
        limit,
        distanceMeasure: 'COSINE',
      });

    const snapshot = await query.get();
    const results: QALogEntry[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        userId: d.userId ?? null,
        nodeId: d.nodeId,
        scenarioId: d.scenarioId,
        experienceLevel: d.experienceLevel,
        question: d.question,
        answer: d.answer,
      };
    });
    return createSuccess(results);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '類似Q&A検索に失敗しました';
    return createError(msg, 'FIRESTORE_QUERY_ERROR');
  }
}

// =============================================================================
// 理解度評価
// =============================================================================

export async function saveEvaluation(
  userId: string,
  evaluation: EvaluationEntry
): Promise<Result<void, FirestoreError>> {
  try {
    await adminDb
      .collection('evaluations')
      .doc(userId)
      .collection('results')
      .add({
        ...evaluation,
        createdAt: FieldValue.serverTimestamp(),
      });
    return createSuccess(undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '評価保存に失敗しました';
    return createError(msg, 'FIRESTORE_WRITE_ERROR');
  }
}

// =============================================================================
// つまずき統計
// =============================================================================

export async function getStumbleStats(
  experienceLevel: ExperienceLevel
): Promise<Result<readonly StumbleStat[], FirestoreError>> {
  try {
    const doc = await adminDb
      .collection('stumble_stats')
      .doc(experienceLevel)
      .get();

    if (!doc.exists) {
      return createSuccess([]);
    }

    const data = doc.data();
    const stats = data?.stats as StumbleStat[] ?? [];
    return createSuccess(stats);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'つまずき統計取得に失敗しました';
    return createError(msg, 'FIRESTORE_READ_ERROR');
  }
}
