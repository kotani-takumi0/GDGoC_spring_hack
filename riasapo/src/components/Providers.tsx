'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';

export function Providers({ children }: { readonly children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
