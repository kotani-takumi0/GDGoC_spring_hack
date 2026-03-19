'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { SessionSyncProvider } from '@/components/SessionSyncProvider';

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <AuthProvider>
      <SessionSyncProvider>{children}</SessionSyncProvider>
    </AuthProvider>
  );
}
