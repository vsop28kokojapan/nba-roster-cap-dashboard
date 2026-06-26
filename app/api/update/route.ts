import { NextResponse } from 'next/server';
import { fetchNbaData } from '@/lib/fetcher';
import { writeLatestData } from '@/lib/supabase';

export const maxDuration = 60;

async function runUpdate(req: Request) {
  const isCron = req.headers.get('x-vercel-cron') === '1';
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!isCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const data = await fetchNbaData();
    await writeLatestData(data);
    return NextResponse.json({ ok: true, updatedAt: data.meta.updatedAt });
  } catch (e) {
    console.error('Update failed:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const GET = runUpdate;
export const POST = runUpdate;
