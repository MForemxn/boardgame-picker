import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_AUTH_COOKIE, cookieMatches, sitePassword } from "@/lib/site-auth";

export async function middleware(req: NextRequest) {
  const password = sitePassword();
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login" || path === "/api/login";

  if (!password) {
    if (isLogin) return NextResponse.next();
    return new NextResponse("Site password is not configured", { status: 401 });
  }

  if (await cookieMatches(req.cookies.get(SITE_AUTH_COOKIE)?.value, password)) {
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (isLogin) return NextResponse.next();

  const login = new URL("/login", req.url);
  const next = `${path}${req.nextUrl.search}`;
  if (next && next !== "/") login.searchParams.set("from", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
