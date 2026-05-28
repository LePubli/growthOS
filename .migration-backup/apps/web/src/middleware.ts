import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/_next', '/favicon', '/api', '/public'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer les routes publiques et assets
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Vérifier cookie auth_token (mis par auth.store.ts au login)
  const cookie = request.cookies.get('auth_token')?.value;

  // Fallback : vérifier header Authorization (SSR)
  const authHeader = request.headers.get('authorization');
  const hasToken = !!cookie || !!authHeader;

  if (!hasToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', encodeURIComponent(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Matcher : toutes les pages sauf _next, static, favicon, login
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|api).*)',
  ],
};
