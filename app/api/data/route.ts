import { NextResponse } from 'next/server';
import { getNBAData } from '@/lib/data';

export function GET() {
  const data = getNBAData();
  return NextResponse.json(data);
}
