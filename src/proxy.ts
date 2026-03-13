import { NextRequest, NextResponse } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.AUTH0_SECRET || "dev-secret-change-me";

/**
 * Verify session cookie using Web Crypto API (Edge-compatible).
 * Returns the decoded user payload or null.
 */
async function verifySession(
  cookieValue: string
): Promise<{ id: number; name: string; email: string } | null> {
  try {
    const [payload, signature] = cookieValue.split(".");
    if (!payload || !signature) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (signature !== expectedSig) return null;

    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (data.exp < Date.now()) return null;

    return { id: data.id, name: data.name, email: data.email };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Pass pathname to server components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Allow login page and auth API routes through without auth
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Check session cookie
  const sessionCookie = request.cookies.get("session")?.value;
  const user = sessionCookie ? await verifySession(sessionCookie) : null;

  if (!user) {
    // API routes get 401 JSON; pages get redirected to login
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|populus-logo\\.svg|populus-logo\\.png|epi-use-logo\\.svg).*)",
  ],
};
