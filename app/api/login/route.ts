import { NextResponse } from "next/server";
import {
  SITE_AUTH_COOKIE,
  gateToken,
  safeEqual,
  sitePassword,
} from "@/lib/site-auth";

export async function POST(req: Request) {
  const password = sitePassword();
  if (!password) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let given = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { password?: string };
    given = String(body.password || "");
  } else {
    const form = await req.formData().catch(() => null);
    given = String(form?.get("password") || "");
  }

  if (!safeEqual(given, password)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SITE_AUTH_COOKIE,
    value: await gateToken(password),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
