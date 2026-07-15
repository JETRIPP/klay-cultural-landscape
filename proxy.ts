import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, computeAuthToken } from "@/lib/auth";

// Next.js 16 renamed middleware.ts -> proxy.ts (exported function renamed
// to `proxy`). Runs on the Node.js runtime by default here, so lib/auth.ts
// can use Node's crypto module directly.
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME);
  if (cookie?.value === computeAuthToken()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|klay-logo-white.png|login|api/login).*)"],
};
