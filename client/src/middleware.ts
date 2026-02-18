import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === '/login' || pathname === '/' || pathname === '/privacy-policy' || pathname === '/terms-of-service') {
    return NextResponse.next();
  }

  // All other routes are handled client-side
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
