import { afterAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";
import { niceMax } from "@/components/LineChart";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const {
  accounts,
  budgetCategories,
  budgets,
  categories,
  categoryType,
  transactions,
  users,
} = await import("@/db/schema");
const {
  listBudgetProgress,
  listMonthlyExpenses,
  listRecentTransactions,
  percentUsed,
} = await import("./dashboard");

afterAll(() => testDb.drop());

const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date();
const thisMonth = iso(
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
);
const lastMonth = iso(
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)),
);
const today = iso(now);

const [me, other] = await db
  .insert(users)
  .values([
    { email: "dash-me@test.local", firstName: "A", lastName: "B" },
    { email: "dash-other@test.local", firstName: "C", lastName: "D" },
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
const [mine, theirs] = await db
  .insert(accounts)
  .values([
    { userId: me.id, slug: "c", name: "Checking", type: "CHECKING" },
    { userId: other.id, slug: "c", name: "Theirs", type: "CHECKING" },
  ])
  .returning();
const [food, fun, pay] = await db
  .insert(categories)
  .values([
    { userId: me.id, name: "Food", typeId: types.EXPENSE },
    { userId: me.id, name: "Fun", typeId: types.EXPENSE },
    { userId: me.id, name: "Pay", typeId: types.INCOME },
  ])
  .returning();

const [foodBudget, funBudget, bothBudget] = await db
  .insert(budgets)
  .values([
    { userId: me.id, name: "Food", month: thisMonth, amount: "200.00" },
    { userId: me.id, name: "Fun", month: thisMonth, amount: "50.00" },
    { userId: me.id, name: "Both", month: thisMonth, amount: "300.00" },
  ])
  .returning();
await db.insert(budgetCategories).values([
  { budgetId: foodBudget.id, categoryId: food.id },
  { budgetId: funBudget.id, categoryId: fun.id },
  { budgetId: bothBudget.id, categoryId: food.id },
  { budgetId: bothBudget.id, categoryId: fun.id },
]);
const tx = (over: Partial<typeof transactions.$inferInsert>) => ({
  userId: me.id,
  accountId: mine.id,
  name: "x",
  date: today,
  amount: "-1.00",
  ...over,
});
await db.insert(transactions).values([
  tx({ categoryId: food.id, amount: "-150.00", name: "Groceries" }),
  tx({ categoryId: fun.id, amount: "-80.00", name: "Concert" }),
  tx({ categoryId: pay.id, amount: "3000.00", name: "Salary" }),
  tx({
    categoryId: food.id,
    amount: "-40.00",
    date: lastMonth,
    name: "Old groceries",
  }),
  tx({
    categoryId: food.id,
    amount: "-999.00",
    name: "Deleted",
    deletedAt: new Date(),
  }),
  tx({
    userId: other.id,
    accountId: theirs.id,
    amount: "-500.00",
    name: "Not mine",
  }),
]);

describe("dashboard queries", () => {
  it("lists the latest transactions, mine only, skipping deleted", async () => {
    const names = (await listRecentTransactions(me.id, 5)).map((t) => t.name);
    expect(names).toHaveLength(4);
    expect(names).not.toContain("Deleted");
    expect(names).not.toContain("Not mine");
    expect(names.at(-1)).toBe("Old groceries");
  });

  it("adds up this month's spending across each budget's categories", async () => {
    const rows = await listBudgetProgress(me.id);
    // Food: 150 (last month's 40 and the deleted 999 don't count). Fun: 80. Both: 230.
    expect(
      rows.map(({ name, assigned, spent }) => ({ name, assigned, spent })),
    ).toEqual([
      { name: "Both", assigned: "300.00", spent: "230.00" },
      { name: "Food", assigned: "200.00", spent: "150.00" },
      { name: "Fun", assigned: "50.00", spent: "80.00" },
    ]);
    expect(rows.map(percentUsed)).toEqual([77, 75, 160]);
    expect(percentUsed({ id: "x", name: "x", assigned: "0", spent: "5" })).toBe(
      0,
    );
  });

  it("totals outflows per month, oldest first, with empty months as 0", async () => {
    const rows = await listMonthlyExpenses(me.id, 6);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)!.total).toBe("230.00");
    expect(rows.at(-2)!.total).toBe("40.00");
    expect(rows.slice(0, 4).every((r) => r.total === "0")).toBe(true);
    expect([...rows].map((r) => r.month).sort()).toEqual(
      rows.map((r) => r.month),
    );
  });
});

describe("niceMax", () => {
  it("rounds axis tops to tidy numbers", () => {
    expect([0, 7, 120, 230, 1401, 9999].map(niceMax)).toEqual([
      1, 10, 200, 250, 2000, 10000,
    ]);
  });
});
