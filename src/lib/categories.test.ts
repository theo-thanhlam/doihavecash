import { afterAll, describe, expect, it } from "vitest";
import { createTestSchema } from "@/test/test-db";

const testDb = await createTestSchema();
const { db } = await import("@/db");
const { categories, categoryType, users } = await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const { createCategory, newCategorySchema } = await import("./categories");

afterAll(() => testDb.drop());

const [me, other] = await db
  .insert(users)
  .values([
    { email: "cat-me@test.local", firstName: "A", lastName: "B" },
    { email: "cat-other@test.local", firstName: "C", lastName: "D" },
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
const [systemRent] = await db
  .insert(categories)
  .values({ userId: null, name: "Rent", typeId: types.EXPENSE })
  .returning();
await db
  .insert(categories)
  .values({ userId: other.id, name: "Hobbies", typeId: types.EXPENSE });

describe("createCategory", () => {
  it("creates a category owned by the user with the right type", async () => {
    const c = await createCategory(me.id, {
      name: "Eating out",
      type: "EXPENSE",
    });
    expect(c).toMatchObject({
      name: "Eating out",
      type: "EXPENSE",
      existed: false,
    });
    const [stored] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, c.id));
    expect(stored).toMatchObject({
      userId: me.id,
      typeId: types.EXPENSE,
      parentId: null,
    });
  });

  it("returns the existing one instead of a duplicate, ignoring case", async () => {
    const first = await createCategory(me.id, {
      name: "Gifts",
      type: "EXPENSE",
    });
    const again = await createCategory(me.id, {
      name: "GIFTS",
      type: "EXPENSE",
    });
    expect(again).toMatchObject({ id: first.id, name: "Gifts", existed: true });
  });

  it("reuses a matching system default", async () => {
    const c = await createCategory(me.id, { name: "rent", type: "EXPENSE" });
    expect(c).toMatchObject({ id: systemRent.id, existed: true });
  });

  it("treats a different type, or another user's category, as new", async () => {
    const income = await createCategory(me.id, {
      name: "Gifts",
      type: "INCOME",
    });
    expect(income.existed).toBe(false);
    const hobbies = await createCategory(me.id, {
      name: "Hobbies",
      type: "EXPENSE",
    });
    expect(hobbies.existed).toBe(false);
    const [stored] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, hobbies.id));
    expect(stored.userId).toBe(me.id);
  });
});

describe("newCategorySchema", () => {
  it("trims names and rejects blanks or unknown types", () => {
    expect(
      newCategorySchema.parse({ name: " Pets ", type: "EXPENSE" }).name,
    ).toBe("Pets");
    expect(
      newCategorySchema.safeParse({ name: "  ", type: "EXPENSE" }).success,
    ).toBe(false);
    expect(
      newCategorySchema.safeParse({ name: "x".repeat(121), type: "INCOME" })
        .success,
    ).toBe(false);
    expect(
      newCategorySchema.safeParse({ name: "Pets", type: "SAVINGS" }).success,
    ).toBe(false);
  });
});
