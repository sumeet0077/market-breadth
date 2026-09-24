import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public path prefixes that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/health",
];

// Static asset extensions that should bypass middleware checks
const STATIC_EXTENSIONS = [
  ".ico",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".css",
  ".js",
  ".woff",
  ".woff2",
  ".txt",
  ".xml",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath = pathname.toLowerCase();
  const hostname = request.nextUrl.hostname || request.headers.get("host") || "";
  const isDemoHost = hostname.startsWith("demo.");

  // 1. Allow Next.js internal paths
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 2. Normalize and check for protected market datasets
  // Strip trailing slashes and normalize duplicate slashes for comparison
  const cleanPath = normalizedPath.replace(/\/+$/, "") || "/";
  const isMarketDataset =
    cleanPath === "/market_breadth.json" ||
    cleanPath === "/drilldowns" ||
    cleanPath.startsWith("/drilldowns/");

  // Session cookie check
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  // If directly accessing raw market dataset files:
  // - If unauthenticated, return 401 Unauthorized
  // - If authenticated, return 403 Forbidden to enforce using authenticated API routes (/api/market-data/*)
  //   which apply entitlements and logging rather than raw static file downloads.
  if (isMarketDataset) {
    if (!sessionCookie) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required to access protected terminal resources.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Direct dataset file access is restricted. Use the authenticated /api/market-data endpoints.",
      },
      { status: 403 }
    );
  }

  // 3. Allow public auth and health routes
  // NOTE: Do not redirect /login -> / blindly based on raw cookie presence.
  // Stale or expired cookies would cause an infinite redirect loop.
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    if (isDemoHost || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-is-demo", "true");
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.headers.set("x-is-demo", "true");
      return response;
    }
    return NextResponse.next();
  }

  // 4. Check for static asset files (CSS, JS, images, icons, fonts)
  if (STATIC_EXTENSIONS.some((ext) => cleanPath.endsWith(ext))) {
    return NextResponse.next();
  }

  // 5. Session cookie check for protected dashboard areas and APIs
  if (!sessionCookie) {
    // A) If request is for an API endpoint, return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required to access protected terminal resources.",
        },
        { status: 401 }
      );
    }

    // B) For pages, redirect to /login with original destination callback
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Request is authenticated: pass through and attach demo headers if applicable
  if (isDemoHost || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-is-demo", "true");
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set("x-is-demo", "true");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
