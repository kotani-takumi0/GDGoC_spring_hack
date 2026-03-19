'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

// =============================================================================
// 型定義
// =============================================================================

interface AuthUser {
  readonly uid: string;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly email: string | null;
}

interface AuthState {
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

interface AuthContextValue {
  readonly state: AuthState;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
  };
}

// =============================================================================
// Provider
// =============================================================================

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setState({
          user: toAuthUser(firebaseUser),
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // セッション情報をクリア
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('riasapo-generated-code');
      sessionStorage.removeItem('riasapo-scenario');
      sessionStorage.removeItem('riasapo-mappings');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
