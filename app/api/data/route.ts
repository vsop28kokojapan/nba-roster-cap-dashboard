import { NextResponse } from 'next/server';
import { getNBAData } from '@/lib/data';

export async function GET() {
  try {
    const data = await getNBAData();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
