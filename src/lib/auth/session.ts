import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  cookieOptions,
  newRefreshToken,
  sha256,
  signAccessToken,
  verifyAccessToken,
  type AccessClaims,
} from "./tokens";

export type SessionTokens = { accessToken: string; refreshToken: string };
type CookieWriter = {
  set(
    name: string,
    value: string,
    options: ReturnType<typeof cookieOptions>,
  ): unknown;
};

/** How long a just-rotated token still counts as "a parallel request won", not as invalid. */
const ROTATION_GRACE_SECONDS = 30;

type SessionUser = { id: string; firstName: string; lastName: string };
const claimsFor = (u: SessionUser): AccessClaims => ({
  sub: u.id,
  name: `${u.firstName} ${u.lastName}`.trim(),
});

export async function issueSession(user: SessionUser): Promise<SessionTokens> {
  const refreshToken = newRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  });
  return { accessToken: await signAccessToken(claimsFor(user)), refreshToken };
}

export type RotateResult =
  | { status: "ok"; tokens: SessionTokens }
  | { status: "race" }
  | { status: "invalid" };

/**
 * Swaps a refresh token for a new pair in one statement: the old token is
 * revoked and the new one inserted together, or neither happens.
 */
export async function rotateRefreshToken(
  oldToken: string,
): Promise<RotateResult> {
  const oldHash = sha256(oldToken);
  const nextToken = newRefreshToken();
  const nextId = randomUUID();

  const { rows } = await db.execute<{
    user_id: string;
    first_name: string;
    last_name: string;
  }>(sql`
    WITH new_token AS (
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      SELECT ${nextId}, rt.user_id, ${sha256(nextToken)}, now() + make_interval(secs => ${REFRESH_TTL_SECONDS})
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id AND u.deleted_at IS NULL
      WHERE rt.token_hash = ${oldHash} AND rt.revoked_at IS NULL AND rt.expires_at > now()
      RETURNING user_id
    )
    UPDATE refresh_tokens rt
    SET revoked_at = now(), replaced_by_id = ${nextId}, updated_at = now()
    FROM new_token, users u
    WHERE rt.token_hash = ${oldHash} AND rt.revoked_at IS NULL AND u.id = new_token.user_id
    RETURNING u.id AS user_id, u.first_name, u.last_name
  `);

  const row = rows[0];
  if (row) {
    const user = {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
    };
    return {
      status: "ok",
      tokens: {
        accessToken: await signAccessToken(claimsFor(user)),
        refreshToken: nextToken,
      },
    };
  }

  // Several requests can race with the same cookie; only one wins. The others
  // must not log the user out, since the browser already holds the new pair.
  const { rows: recent } = await db.execute(sql`
    SELECT 1 FROM refresh_tokens
    WHERE token_hash = ${oldHash} AND replaced_by_id IS NOT NULL
      AND revoked_at > now() - make_interval(secs => ${ROTATION_GRACE_SECONDS})
  `);
  return recent.length ? { status: "race" } : { status: "invalid" };
}

export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.tokenHash, sha256(token)),
        isNull(refreshTokens.revokedAt),
      ),
    );
}

export function writeSessionCookies(jar: CookieWriter, tokens: SessionTokens) {
  jar.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_TTL_SECONDS));
  jar.set(
    REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_TTL_SECONDS),
  );
}

export function clearSessionCookies(jar: CookieWriter) {
  jar.set(ACCESS_COOKIE, "", cookieOptions(0));
  jar.set(REFRESH_COOKIE, "", cookieOptions(0));
}

/** The signed-in user for Server Components and Server Actions, or null. */
export async function getCurrentUser(): Promise<AccessClaims | null> {
  const jar = await cookies();
  return verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
}

/** For protected pages: the signed-in user, or a redirect to sign in that returns here afterwards. */
export async function requireUser(returnTo?: string): Promise<AccessClaims> {
  const user = await getCurrentUser();
  if (!user)
    redirect(returnTo ? `/auth?next=${encodeURIComponent(returnTo)}` : "/auth");
  return user;
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)));
  return user ?? null;
}
