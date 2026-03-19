'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/AuthProvider';

// =============================================================================
// 型定義
// =============================================================================

interface SessionSyncContextValue {
  readonly saveToSession: (key: string, data: unknown) => Promise<void>;
  readonly loadFromSession: (key: string) => unknown | null;
  readonly isSyncing: boolean;
}

// =============================================================================
// Context
// =============================================================================

const SessionSyncContext = createContext<SessionSyncContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function SessionSyncProvider({ children }: { readonly children: ReactNode }) {
  const { state } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [restored, setRestored] = useState(false);

  // アプリ起動時: 認証済みならFirestoreからSessionStorageを復元
  useEffect(() => {
    if (!state.isAuthenticated || !state.user || restored) return;

    async function restoreSession() {
      try {
        setIsSyncing(true);
        const res = await fetch(`/api/session?userId=${state.user!.uid}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!data.session) return;

        const { session } = data;

        // generatedCodeを復元
        if (session.generatedCode) {
          sessionStorage.setItem(
            'riasapo-generated-code',
            JSON.stringify(session.generatedCode)
          );
        }

        // mappingsを復元
        if (session.mappings) {
          sessionStorage.setItem(
            'riasapo-mappings',
            JSON.stringify(session.mappings)
          );
        }

        // scenarioを復元
        if (session.scenarioId) {
          sessionStorage.setItem(
            'riasapo-scenario',
            JSON.stringify({
              scenarioId: session.scenarioId,
              experienceLevel: session.experienceLevel,
              mode: session.mode,
            })
          );
        }
      } catch {
        // 復元失敗は無視（SessionStorageの既存値を使う）
      } finally {
        setIsSyncing(false);
        setRestored(true);
      }
    }

    restoreSession();
  }, [state.isAuthenticated, state.user, restored]);

  // SessionStorage書き込み + Firestore同期
  const saveToSession = useCallback(
    async (key: string, data: unknown) => {
      // 常にSessionStorageに保存
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(data));
      }

      // 認証済みならFirestoreにも保存（非同期・失敗しても続行）
      if (state.isAuthenticated && state.user) {
        try {
          setIsSyncing(true);
          await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: state.user.uid,
              key,
              data,
            }),
          });
        } catch {
          // Firestore同期失敗はSessionStorageの値を維持
          console.warn(`[SessionSync] Firestore同期失敗: ${key}`);
        } finally {
          setIsSyncing(false);
        }
      }
    },
    [state.isAuthenticated, state.user]
  );

  // SessionStorageから読み込み
  const loadFromSession = useCallback((key: string): unknown | null => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  return (
    <SessionSyncContext.Provider value={{ saveToSession, loadFromSession, isSyncing }}>
      {children}
    </SessionSyncContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useSessionSync(): SessionSyncContextValue {
  const context = useContext(SessionSyncContext);
  if (!context) {
    throw new Error('useSessionSync must be used within a SessionSyncProvider');
  }
  return context;
}
