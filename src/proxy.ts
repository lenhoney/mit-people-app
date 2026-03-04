import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function proxy(request: Request) {
  const authResponse = await auth0.middleware(request);
  const { pathname } = new URL(request.url);

  // Auth routes (/auth/*) are handled by the SDK — return early
  if (pathname.startsWith("/auth")) {
    return authResponse;
  }

  // Check session for all other routes
  const session = await auth0.getSession(request);
  if (!session) {
    // API routes get 401 JSON; pages get redirected to login
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
