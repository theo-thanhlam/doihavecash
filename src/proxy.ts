import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyAccessToken,
} from "@/lib/auth/tokens";
import {
  clearSessionCookies,
  rotateRefreshToken,
  writeSessionCookies,
} from "@/lib/auth/session";

/**
 * Paths anyone can open. Everything else needs a signed-in user, so pages in
 * app/(protected) are covered without listing them. Add public routes
 * (e.g. webhooks) here.
 */
export const PUBLIC_PATHS = ["/", "/auth"];
/** Paths a signed-in user is sent away from. */
const GUEST_ONLY = ["/auth"];

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let signedIn = Boolean(
    await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value),
  );
  let response: NextResponse | null = null;

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!signedIn && refresh) {
    const result = await rotateRefreshToken(refresh).catch((err) => {
      console.error("Token refresh failed", err);
      return { status: "race" as const }; // DB hiccup: keep cookies, treat as signed out for now
    });
    if (result.status === "ok") {
      // Let this same request's Server Components see the new tokens.
      request.cookies.set(ACCESS_COOKIE, result.tokens.accessToken);
      request.cookies.set(REFRESH_COOKIE, result.tokens.refreshToken);
      response = NextResponse.next({ request: { headers: request.headers } });
      writeSessionCookies(response.cookies, result.tokens);
      signedIn = true;
    } else if (result.status === "invalid") {
      request.cookies.delete(REFRESH_COOKIE);
      response = NextResponse.next({ request: { headers: request.headers } });
      clearSessionCookies(response.cookies);
    }
  }

  let redirect: URL | null = null;
  if (!signedIn && !matches(path, PUBLIC_PATHS)) {
    redirect = new URL("/auth", request.url);
    redirect.searchParams.set("next", path + request.nextUrl.search);
  } else if (signedIn && matches(path, GUEST_ONLY)) {
    redirect = new URL("/dashboard", request.url);
  }

  if (redirect) {
    const res = NextResponse.redirect(redirect);
    // Keep any cookies set above (new tokens or a clear).
    response?.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }
  return response ?? NextResponse.next();
}

export const config = {
  // Skip Next internals and static files (anything with a file extension).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
