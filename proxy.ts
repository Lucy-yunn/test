import createMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

/**
 * Renamed from `middleware` in Next 16 (AGENTS.md / ADR-0001). Node runtime.
 *
 * Two jobs, in order:
 *  1. Optimistic cookie-only auth redirect for /account, /seller, /admin.
 *     NOT a security boundary — the DAL is (docs/auth-and-permissions.md §10).
 *     Only checks that a session cookie exists; role redirects happen in the DAL.
 *  2. next-intl locale routing.
 */
const intlMiddleware = createMiddleware(routing);

const PROTECTED_PREFIXES = ["/account", "/seller", "/admin"];

function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/(en|bg)(?=\/|$)/, "");
  return stripped === "" ? "/" : stripped;
}

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const path = stripLocale(pathname);

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (needsAuth && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API routes (incl. Better Auth), Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
