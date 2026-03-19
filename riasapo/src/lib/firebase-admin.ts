// =============================================================================
// Firebase Admin SDK 初期化（サーバーサイド専用）
// =============================================================================

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Cloud Run: ADC自動認証（環境変数なしでOK）
  // ローカル: gcloud auth application-default login で認証済み前提
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'gdghackathon-7ff23';

  // サービスアカウントキーが明示的にある場合はそちらを使用
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  // ADC（Cloud Run / ローカル gcloud auth）
  return initializeApp({ projectId });
}

const adminApp = createAdminApp();

export const adminDb: Firestore = getFirestore(adminApp);
