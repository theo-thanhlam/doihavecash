import { afterAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const { budgetCategories, budgets, categories, categoryType, users } =
  await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const { budgetSchema, createBudget } = await import("./budgets");
const { listBudgetProgress } = await import("./dashboard");

afterAll(() => testDb.drop());

const [me, other] = await db
  .insert(users)
  .values([
    { email: "bud-me@test.local", firstName: "A", lastName: "B" },
    { email: "bud-other@test.local", firstName: "C", lastName: "D" },
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
const [food, fun, salary, systemRent, theirs] = await db
  .insert(categories)
  .values([
    { userId: me.id, name: "Food", typeId: types.EXPENSE },
    { userId: me.id, name: "Fun", typeId: types.EXPENSE },
    { userId: me.id, name: "Salary", typeId: types.INCOME },
    { userId: null, name: "Rent", typeId: types.EXPENSE },
    { userId: other.id, name: "Theirs", typeId: types.EXPENSE },
  ])
  .returning();

const input = (categoryIds: string[], over: Record<string, string> = {}) =>
  budgetSchema.parse({
    name: "Going out",
    amount: "300",
    categoryIds,
    ...over,
  });

const linkedTo = async (budgetId: string) =>
  (
    await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.budgetId, budgetId))
  )
    .map((r) => r.categoryId)
    .sort();

describe("createBudget", () => {
  it("saves one budget for this month linked to every chosen category", async () => {
    const id = (await createBudget(
      me.id,
      input([food.id, fun.id, systemRent.id]),
    ))!;
    expect(id).toBeTruthy();
    expect(await linkedTo(id)).toEqual([food.id, fun.id, systemRent.id].sort());
    const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
    expect(row).toMatchObject({
      name: "Going out",
      amount: "300.00",
      userId: me.id,
    });
    expect(row.month.endsWith("-01")).toBe(true);
    expect(await listBudgetProgress(me.id)).toEqual([
      { id, name: "Going out", assigned: "300.00", spent: "0" },
    ]);
  });

  it("saves nothing if any category is income or someone else's", async () => {
    const before = (await db.select().from(budgets)).length;
    expect(await createBudget(me.id, input([food.id, salary.id]))).toBeNull();
    expect(await createBudget(me.id, input([food.id, theirs.id]))).toBeNull();
    expect((await db.select().from(budgets)).length).toBe(before);
  });

  it("keeps each user's budgets separate", async () => {
    expect(await listBudgetProgress(other.id)).toEqual([]);
  });
});

describe("budgetSchema", () => {
  it("needs a name, at least one category, and a positive amount", () => {
    expect(
      budgetSchema.safeParse({ name: "x", amount: "5", categoryIds: [] })
        .success,
    ).toBe(false);
    expect(
      budgetSchema.safeParse({ name: " ", amount: "5", categoryIds: [food.id] })
        .success,
    ).toBe(false);
    for (const amount of ["0", "-5", "1.234", "abc", ""]) {
      expect(
        budgetSchema.safeParse({ name: "x", amount, categoryIds: [food.id] })
          .success,
        amount,
      ).toBe(false);
    }
  });

  it("drops duplicate categories", () => {
    expect(input([food.id, food.id]).categoryIds).toEqual([food.id]);
  });
});
