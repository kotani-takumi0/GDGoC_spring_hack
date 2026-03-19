// =============================================================================
// GET /api/stumble-stats — つまずき統計データの取得
// =============================================================================

import { NextResponse } from 'next/server';
import { getStumbleStats } from '@/lib/firestore-service';
import type { ExperienceLevel } from '@/types';

const VALID_LEVELS: readonly ExperienceLevel[] = [
  'complete-beginner',
  'python-experienced',
  'other-language-experienced',
];

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') as ExperienceLevel | null;

  if (!level || !VALID_LEVELS.includes(level)) {
    return NextResponse.json(
      { error: 'level パラメータが不正です' },
      { status: 400 }
    );
  }

  const result = await getStumbleStats(level);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stats: result.data });
}
