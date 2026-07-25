import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.OCTACLIN_BACKEND_URL?.trim() ?? '';
  return NextResponse.redirect(`${backendUrl.replace(/\/$/, '')}/agenda/google/conectar`);
}
