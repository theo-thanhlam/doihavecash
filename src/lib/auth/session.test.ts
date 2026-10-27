import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createTestSchema } from "@/test/test-db";

// Stand-in for the request cookie jar that Server Components read.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
  }),
}));

const testDb = await createTestSchema();
const { db } = await import("@/db");
const { refreshTokens, users } = await import("@/db/schema");
const { eq, sql } = await import("drizzle-orm");
const { issueSession, revokeRefreshToken, rotateRefreshToken } =
  await import("./session");
const { sha256, verifyAccessToken, signAccessToken } = await import("./tokens");
const { proxy } = await import("@/proxy");
const { requireUser } = await import("./session");
const { listOpenAccountsWithBalance } = await import("@/lib/accounts");
const { accounts, transactions } = await import("@/db/schema");

afterAll(() => testDb.drop());

let n = 0;
async function makeUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `user${++n}@test.local`,
      firstName: "Grace",
      lastName: "Hopper",
    })
    .returning();
  return user;
}
const rowFor = async (token: string) =>
  (
    await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(token)))
  )[0];

describe("refresh token rotation", () => {
  it("swaps an old token for a new pair and links them", async () => {
    const user = await makeUser();
    const first = await issueSession(user);
    const result = await rotateRefreshToken(first.refreshToken);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(await verifyAccessToken(result.tokens.accessToken)).toEqual({
      sub: user.id,
      name: "Grace Hopper",
    });
    const oldRow = await rowFor(first.refreshToken);
    const newRow = await rowFor(result.tokens.refreshToken);
    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedById).toBe(newRow.id);
    expect(newRow.revokedAt).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, user.id));
    expect(rows.map((r) => r.tokenHash)).not.toContain(refreshToken);
  });

  it("lets only one of two parallel refreshes win, without logging out the other", async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    const results = await Promise.all([
      rotateRefreshToken(refreshToken),
      rotateRefreshToken(refreshToken),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["ok", "race"]);
  });

  it("rejects an old token once the grace window has passed", async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    await rotateRefreshToken(refreshToken);
    await db.execute(
      sql`UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE token_hash = ${sha256(refreshToken)}`,
    );
    expect((await rotateRefreshToken(refreshToken)).status).toBe("invalid");
  });

  it("rejects signed-out, expired, unknown, and deleted-user tokens", async () => {
    const user = await makeUser();
    const signedOut = (await issueSession(user)).refreshToken;
    await revokeRefreshToken(signedOut);

    const expired = (await issueSession(user)).refreshToken;
    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(refreshTokens.tokenHash, sha256(expired)));

    const gone = await makeUser();
    const deletedUser = (await issueSession(gone)).refreshToken;
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, gone.id));

    for (const token of [signedOut, expired, "not-a-real-token", deletedUser]) {
      expect((await rotateRefreshToken(token)).status).toBe("invalid");
    }
  });
});

describe("proxy", () => {
  const req = (path: string, cookies: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${path}`, {
      headers: {
        cookie: Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
    });

  it("sends signed-out visitors from protected pages to sign in", async () => {
    const res = await proxy(req("/dashboard?tab=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth?next=%2Fdashboard%3Ftab%3D1",
    );
  });

  it("rejects a forged access token on protected pages", async () => {
    const res = await proxy(
      req("/dashboard", { accessToken: "forged.token.value" }),
    );
    expect(res.status).toBe(307);
  });

  it("lets a valid access token through and keeps signed-in users off /auth", async () => {
    const user = await makeUser();
    const accessToken = await signAccessToken({
      sub: user.id,
      name: "Grace Hopper",
    });
    expect((await proxy(req("/dashboard", { accessToken }))).status).toBe(200);
    const res = await proxy(req("/auth", { accessToken }));
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("refreshes an expired session using the refresh token", async () => {
    const user = await makeUser();
    const { refreshToken } = await issueSession(user);
    const res = await proxy(req("/dashboard", { refreshToken }));

    expect(res.status).toBe(200);
    const newAccess = res.cookies.get("accessToken")?.value;
    const newRefresh = res.cookies.get("refreshToken")?.value;
    expect(await verifyAccessToken(newAccess)).toMatchObject({ sub: user.id });
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(refreshToken);
    expect(res.cookies.get("refreshToken")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("clears cookies and redirects when the refresh token is invalid", async () => {
    const res = await proxy(
      req("/dashboard", { refreshToken: "stolen-or-old" }),
    );
    expect(res.status).toBe(307);
    expect(res.cookies.get("refreshToken")?.value).toBe("");
  });
});

describe("dashboard guard", () => {
  it("redirects a signed-out or forged visitor to sign in, then back", async () => {
    for (const token of [undefined, "forged.token.value"]) {
      jar.clear();
      if (token) jar.set("accessToken", token);
      await expect(requireUser("/dashboard")).rejects.toMatchObject({
        digest: expect.stringContaining("/auth?next=%2Fdashboard"),
      });
    }
  });

  it("lets a signed-in user in", async () => {
    const user = await makeUser();
    jar.set(
      "accessToken",
      await signAccessToken({ sub: user.id, name: "Grace Hopper" }),
    );
    expect(await requireUser("/dashboard")).toEqual({
      sub: user.id,
      name: "Grace Hopper",
    });
  });

  it("shows only your own open accounts, with balances", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const [mine] = await db
      .insert(accounts)
      .values([
        { userId: me.id, slug: "checking", name: "Checking", type: "CHECKING" },
        {
          userId: me.id,
          slug: "closed",
          name: "Closed",
          type: "CASH",
          archivedAt: new Date(),
        },
        {
          userId: other.id,
          slug: "checking",
          name: "Their checking",
          type: "CHECKING",
        },
      ])
      .returning();
    await db.insert(transactions).values([
      {
        userId: me.id,
        accountId: mine.id,
        name: "Pay",
        amount: "100.50",
        date: "2026-10-01",
      },
      {
        userId: me.id,
        accountId: mine.id,
        name: "Shop",
        amount: "-40.25",
        date: "2026-10-02",
      },
    ]);

    expect(await listOpenAccountsWithBalance(me.id)).toEqual([
      {
        slug: "checking",
        name: "Checking",
        type: "CHECKING",
        balance: "60.25",
      },
    ]);
  });
});

describe("sign in with an unknown email", () => {
  it("goes straight to sign up without creating a code", async () => {
    const { sendCode } = await import("@/app/auth/actions");
    const { getRedis } = await import("@/lib/redis");
    const form = new FormData();
    form.set("mode", "signin");
    form.set("email", "  Nobody@Test.Local ");

    expect(await sendCode(null, form)).toEqual({
      status: 404,
      message: "No account uses this email yet. Add your name to sign up.",
      data: { step: "needs_signup", email: "nobody@test.local" },
    });
    const redis = await getRedis();
    expect(
      await redis.exists([
        "otp:code:nobody@test.local",
        "otp:cooldown:nobody@test.local",
      ]),
    ).toBe(0);
    await redis.quit();
  });
});

describe("proxy: everything but public paths needs sign-in", () => {
  const req = (path: string) => new NextRequest(`http://localhost${path}`);

  it("redirects signed-out visitors from any non-public path", async () => {
    for (const path of [
      "/dashboard",
      "/accounts",
      "/budgets/2026-10",
      "/brand-new-page",
      "/authx",
    ]) {
      const res = await proxy(req(path));
      expect(res.status, path).toBe(307);
      expect(res.headers.get("location"), path).toBe(
        `http://localhost/auth?next=${encodeURIComponent(path)}`,
      );
    }
  });

  it("lets anyone open the public paths", async () => {
    for (const path of ["/", "/auth", "/auth/anything"]) {
      expect((await proxy(req(path))).status, path).toBe(200);
    }
  });
});
