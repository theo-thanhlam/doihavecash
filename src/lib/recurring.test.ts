import { afterAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const {
  accounts,
  categories,
  categoryType,
  recurringPayments,
  transactions,
  users,
} = await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const {
  createRecurring,
  listActiveRecurring,
  markRecurringPaid,
  recurringSchema,
  removeRecurring,
  updateRecurring,
} = await import("./recurring");

afterAll(() => testDb.drop());

const [me, other] = await db
  .insert(users)
  .values([
    { email: "rec-me@test.local", firstName: "A", lastName: "B" },
    { email: "rec-other@test.local", firstName: "C", lastName: "D" },
  ])
  .returning();
const types = Object.fromEntries(
  (
    await db
      .insert(categoryType)
      .values([{ name: "INCOME" }, { name: "EXPENSE" }])
      .returning()
  ).map((t) => [t.name, t.id]),
);
const [checking] = await db
  .insert(accounts)
  .values([
    { userId: me.id, slug: "checking", name: "Checking", type: "CHECKING" },
    { userId: other.id, slug: "theirs", name: "Theirs", type: "CHECKING" },
  ])
  .returning();
const [streaming, salary] = await db
  .insert(categories)
  .values([
    { userId: me.id, name: "Streaming", typeId: types.EXPENSE },
    { userId: me.id, name: "Salary", typeId: types.INCOME },
  ])
  .returning();

const input = (over: Record<string, string> = {}) =>
  recurringSchema.parse({
    name: "Netflix",
    categoryId: streaming.id,
    amount: "15.99",
    accountSlug: "checking",
    frequency: "MONTHLY",
    nextDueDate: "2026-11-05",
    ...over,
  });
const schedule = async (id: string) =>
  (
    await db
      .select()
      .from(recurringPayments)
      .where(eq(recurringPayments.id, id))
  )[0];

describe("recurring payments", () => {
  it("stores expenses negative and income positive", async () => {
    const netflix = (await createRecurring(me.id, input()))!;
    const pay = (await createRecurring(
      me.id,
      input({ name: "Pay", categoryId: salary.id, amount: "3000" }),
    ))!;
    expect((await schedule(netflix)).amount).toBe("-15.99");
    expect((await schedule(pay)).amount).toBe("3000.00");
  });

  it("refuses another user's account", async () => {
    expect(
      await createRecurring(me.id, input({ accountSlug: "theirs" })),
    ).toBeNull();
  });

  it("mark paid records a transaction and moves the due date by the frequency", async () => {
    for (const [freq, next] of [
      ["WEEKLY", "2026-11-12"],
      ["MONTHLY", "2026-12-05"],
      ["QUARTERLY", "2027-02-05"],
      ["YEARLY", "2027-11-05"],
    ]) {
      const id = (await createRecurring(me.id, input({ frequency: freq })))!;
      const txId = await markRecurringPaid(me.id, id, "2026-11-04");
      expect(txId, freq).toBeTruthy();
      expect((await schedule(id)).nextDueDate, freq).toBe(next);
      const [tx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txId!));
      expect(tx).toMatchObject({
        name: "Netflix",
        amount: "-15.99",
        date: "2026-11-04",
        accountId: checking.id,
        categoryId: streaming.id,
      });
    }
  });

  it("edits every field, re-signing from the new category", async () => {
    const id = (await createRecurring(me.id, input()))!;
    const updated = await updateRecurring(
      me.id,
      id,
      input({
        name: "Pay",
        categoryId: salary.id,
        amount: "2500",
        frequency: "WEEKLY",
        nextDueDate: "2026-12-01",
      }),
    );
    expect(updated).toBe(id);
    expect(await schedule(id)).toMatchObject({
      name: "Pay",
      amount: "2500.00",
      frequency: "WEEKLY",
      nextDueDate: "2026-12-01",
    });
  });

  it("only lets the owner edit or remove, and removed ones are gone", async () => {
    const id = (await createRecurring(me.id, input()))!;
    expect(
      await updateRecurring(other.id, id, input({ name: "Hacked" })),
    ).toBeNull();
    expect(
      await updateRecurring(me.id, id, input({ accountSlug: "theirs" })),
    ).toBeNull();
    expect(await removeRecurring(other.id, id)).toBe(false);
    expect((await schedule(id)).name).toBe("Netflix");

    expect(await removeRecurring(me.id, id)).toBe(true);
    expect((await schedule(id)).deletedAt).not.toBeNull();
    expect(await removeRecurring(me.id, id)).toBe(false);
    expect(await updateRecurring(me.id, id, input())).toBeNull();
    expect(await markRecurringPaid(me.id, id, "2026-11-04")).toBeNull();
    expect(await markRecurringPaid(other.id, id, "2026-11-04")).toBeNull();
    expect((await listActiveRecurring(me.id)).map((r) => r.id)).not.toContain(
      id,
    );
  });

  it("lists only your active schedules, soonest first", async () => {
    const later = (await createRecurring(
      me.id,
      input({ name: "Gym", nextDueDate: "2030-01-01" }),
    ))!;
    const rows = await listActiveRecurring(me.id);
    expect(rows.at(-1)).toMatchObject({
      id: later,
      name: "Gym",
      account_name: "Checking",
      category_name: "Streaming",
    });
    const dates = rows.map((r) => r.next_due_date);
    expect([...dates].sort()).toEqual(dates);
    expect(await listActiveRecurring(other.id)).toEqual([]);
  });
});
