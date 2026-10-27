import { afterAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const { accounts, users } = await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const { createAccount, newAccountSchema, slugify } = await import("./accounts");

afterAll(() => testDb.drop());

const [me, other] = await db
  .insert(users)
  .values([
    { email: "acc-me@test.local", firstName: "A", lastName: "B" },
    { email: "acc-other@test.local", firstName: "C", lastName: "D" },
  ])
  .returning();

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("Joint Checking!")).toBe("joint-checking");
    expect(slugify("  Épargne   Café ")).toBe("epargne-cafe");
    expect(slugify("💰💰")).toBe("account");
    expect(slugify("a".repeat(150))).toHaveLength(100);
  });
});

describe("createAccount", () => {
  it("saves the account for the user, numbering duplicate names", async () => {
    const input = { name: "Savings", type: "SAVINGS" } as const;
    expect(await createAccount(me.id, input)).toBe("savings");
    expect(await createAccount(me.id, input)).toBe("savings-2");
    expect(await createAccount(me.id, input)).toBe("savings-3");
    // Slugs are only unique per user.
    expect(await createAccount(other.id, input)).toBe("savings");

    const mine = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, me.id));
    expect(mine).toHaveLength(3);
    expect(mine[0]).toMatchObject({
      name: "Savings",
      type: "SAVINGS",
      archivedAt: null,
    });
  });

  it("handles parallel adds with the same name", async () => {
    const input = { name: "Wallet", type: "CASH" } as const;
    const slugs = await Promise.all([
      createAccount(me.id, input),
      createAccount(me.id, input),
    ]);
    expect(slugs.sort()).toEqual(["wallet", "wallet-2"]);
  });
});

describe("newAccountSchema", () => {
  it("trims the name and rejects blank names or unknown types", () => {
    expect(newAccountSchema.parse({ name: "  Cash  ", type: "CASH" })).toEqual({
      name: "Cash",
      type: "CASH",
    });
    expect(
      newAccountSchema.safeParse({ name: "   ", type: "CASH" }).success,
    ).toBe(false);
    expect(
      newAccountSchema.safeParse({ name: "x".repeat(121), type: "CASH" })
        .success,
    ).toBe(false);
    expect(
      newAccountSchema.safeParse({ name: "Gold", type: "BITCOIN" }).success,
    ).toBe(false);
  });
});
