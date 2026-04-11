import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-config";

const PUBLIC_PATHS = new Set(["/", "/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes and public paths
  if (pathname.startsWith("/api/") || PUBLIC_PATHS.has(pathname)) {
    const response = NextResponse.next();
    // If already logged in, redirect /login → /dashboard
    if (pathname === "/login") {
      const session = await getIronSession<SessionData>(
        request,
        response,
        sessionOptions
      );
      if (session.userId) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return response;
  }

  // All other routes require authentication
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
