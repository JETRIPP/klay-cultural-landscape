import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, checkPassphrase, computeAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const passphrase = String(formData.get("passphrase") ?? "");
  const from = String(formData.get("from") ?? "/");

  if (!checkPassphrase(passphrase)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", from);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(from || "/", request.url), { status: 303 });
  response.cookies.set(AUTH_COOKIE_NAME, computeAuthToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
