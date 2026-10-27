import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const { accounts, categories, categoryType, transactions, users } =
  await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const {
  createTransaction,
  deleteTransaction,
  listCategoriesForUser,
  listTransactions,
  transactionSchema,
  updateTransaction,
} = await import("./transactions");

afterAll(() => testDb.drop());

let me: { id: string };
let other: { id: string };
let cat: Record<string, string>;

beforeAll(async () => {
  [me, other] = await db
    .insert(users)
    .values([
      { email: "me@test.local", firstName: "Me", lastName: "Mine" },
      { email: "other@test.local", firstName: "Oth", lastName: "Er" },
    ])
    .returning();
  const t = await db
    .insert(categoryType)
    .values([{ name: "INCOME" }, { name: "EXPENSE" }])
    .returning();
  const types = Object.fromEntries(t.map((r) => [r.name, r.id]));

  await db.insert(accounts).values([
    { userId: me.id, slug: "checking", name: "Checking", type: "CHECKING" },
    { userId: me.id, slug: "savings", name: "Savings", type: "SAVINGS" },
    {
      userId: me.id,
      slug: "closed",
      name: "Closed",
      type: "CASH",
      archivedAt: new Date(),
    },
    { userId: other.id, slug: "theirs", name: "Theirs", type: "CHECKING" },
  ]);

  const c = await db
    .insert(categories)
    .values([
      { userId: me.id, name: "Groceries", typeId: types.EXPENSE },
      { userId: me.id, name: "Salary", typeId: types.INCOME },
      { userId: null, name: "System rent", typeId: types.EXPENSE },
      { userId: other.id, name: "Their food", typeId: types.EXPENSE },
    ])
    .returning();
  cat = Object.fromEntries(c.map((r) => [r.name, r.id]));
});

const input = (over: Record<string, string> = {}) =>
  transactionSchema.parse({
    name: "Grocery run",
    accountSlug: "checking",
    categoryId: cat.Groceries,
    amount: "12.50",
    date: "2026-10-27",
    ...over,
  });

const row = async (id: string) =>
  (await db.select().from(transactions).where(eq(transactions.id, id)))[0];

describe("createTransaction", () => {
  it("takes the sign from the category: expenses negative, income positive", async () => {
    const expense = await createTransaction(
      me.id,
      input({ note: "  weekly shop  " }),
    );
    const income = await createTransaction(
      me.id,
      input({ name: "Pay", categoryId: cat.Salary, amount: "3200" }),
    );
    expect(await row(expense!)).toMatchObject({
      name: "Grocery run",
      note: "weekly shop",
      amount: "-12.50",
      date: "2026-10-27",
      userId: me.id,
    });
    expect(await row(income!)).toMatchObject({ amount: "3200.00", note: null });
  });

  it("allows system default categories", async () => {
    expect(
      await createTransaction(me.id, input({ categoryId: cat["System rent"] })),
    ).toBeTruthy();
  });

  it("refuses another user's account or category, and archived accounts", async () => {
    for (const bad of <Record<string, string>[]>[
      { accountSlug: "theirs" },
      { accountSlug: "closed" },
      { accountSlug: "missing" },
      { categoryId: cat["Their food"] },
    ]) {
      expect(
        await createTransaction(me.id, input(bad)),
        JSON.stringify(bad),
      ).toBeNull();
    }
  });

  it("lists only your categories plus system defaults", async () => {
    const names = (await listCategoriesForUser(me.id)).map((c) => c.name);
    expect(names).toEqual(["Groceries", "Salary", "System rent"]);
  });
});

describe("updateTransaction", () => {
  it("changes every field but the date, re-signing from the new category", async () => {
    const id = (await createTransaction(me.id, input()))!;
    const updated = await updateTransaction(
      me.id,
      id,
      input({
        name: "Refund",
        categoryId: cat.Salary,
        amount: "5",
        accountSlug: "savings",
        note: "returned item",
        date: "2030-01-01",
      }),
    );
    expect(updated).toBe(id);
    expect(await row(id)).toMatchObject({
      name: "Refund",
      amount: "5.00",
      note: "returned item",
      date: "2026-10-27",
    });
  });

  it("refuses someone else's transaction and bad accounts", async () => {
    const id = (await createTransaction(me.id, input()))!;
    expect(await updateTransaction(other.id, id, input())).toBeNull();
    expect(
      await updateTransaction(me.id, id, input({ accountSlug: "theirs" })),
    ).toBeNull();
    expect((await row(id)).accountId).toBeTruthy();
  });
});

describe("deleteTransaction", () => {
  it("soft-deletes your own transaction once", async () => {
    const id = (await createTransaction(me.id, input()))!;
    expect(await deleteTransaction(other.id, id)).toBe(false);
    expect((await row(id)).deletedAt).toBeNull();

    expect(await deleteTransaction(me.id, id)).toBe(true);
    expect((await row(id)).deletedAt).not.toBeNull();
    expect(await deleteTransaction(me.id, id)).toBe(false);
    expect(await updateTransaction(me.id, id, input())).toBeNull();
  });
});

describe("listTransactions", () => {
  it("lists only your live transactions, newest first, with edit fields", async () => {
    const old = (await createTransaction(
      me.id,
      input({ name: "Old", date: "2020-01-01" }),
    ))!;
    const recent = (await createTransaction(
      me.id,
      input({ name: "Recent", date: "2031-01-01", note: "hi" }),
    ))!;
    const gone = (await createTransaction(me.id, input({ name: "Gone" })))!;
    await deleteTransaction(me.id, gone);
    await createTransaction(other.id, {
      ...input(),
      accountSlug: "theirs",
      categoryId: cat["Their food"],
    });

    const rows = await listTransactions(me.id);
    const ids = rows.map((r) => r.id);
    expect(ids[0]).toBe(recent);
    expect(ids.at(-1)).toBe(old);
    expect(ids).not.toContain(gone);
    expect(rows.every((r) => r.account_slug !== "theirs")).toBe(true);
    expect(rows[0]).toMatchObject({
      name: "Recent",
      amount: "-12.50",
      note: "hi",
      category_id: cat.Groceries,
      category_name: "Groceries",
      account_slug: "checking",
      account_name: "Checking",
    });
  });
});

describe("transactionSchema", () => {
  it("rejects bad amounts, blank names and long notes", () => {
    for (const amount of [
      "0",
      "-5",
      "1.234",
      "abc",
      "",
      "1e5",
      "1234567890123",
    ]) {
      expect(
        transactionSchema.safeParse({ ...input(), amount }).success,
        amount,
      ).toBe(false);
    }
    expect(
      transactionSchema.safeParse({ ...input(), name: "  " }).success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...input(), note: "x".repeat(1001) })
        .success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...input(), categoryId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });

  it("treats a blank note as no note", () => {
    expect(
      transactionSchema.parse({ ...input(), note: "   " }).note,
    ).toBeNull();
  });
});
