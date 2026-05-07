import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/';
  return NextResponse.redirect(new URL(next, request.url));
}
