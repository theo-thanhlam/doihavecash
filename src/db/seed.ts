// Seeds a demo user you can sign in as (demo@doihavemoney.local; code arrives in Mailpit).
// Safe to re-run: skips anything already there.
import { and, eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  accounts,
  budgetCategories,
  budgets,
  categories,
  categoryType,
  recurringPayments,
  transactions,
  users,
} from "./schema";

const DEMO_EMAIL = "demo@doihavemoney.local";
const month = new Date().toISOString().slice(0, 8) + "01";
const day = (d: number) => month.slice(0, 8) + String(d).padStart(2, "0");

const isoDaysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Demo subscriptions, including an overdue one. Added once per demo user. */
async function seedSubscriptions(userId: string) {
  if (
    (
      await db
        .select()
        .from(recurringPayments)
        .where(eq(recurringPayments.userId, userId))
    ).length
  )
    return;
  const [checking] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.slug, "everyday-checking")),
    );
  const [rent] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, "Rent")));
  const [fun] = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.name, "Fun money")),
    );
  if (!checking) return;

  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
  await db.insert(recurringPayments).values([
    {
      userId,
      accountId: checking.id,
      categoryId: rent?.id,
      name: "Rent",
      amount: "-1400.00",
      frequency: "MONTHLY",
      nextDueDate: nextMonth.toISOString().slice(0, 10),
    },
    {
      userId,
      accountId: checking.id,
      categoryId: fun?.id,
      name: "Netflix",
      amount: "-15.99",
      frequency: "MONTHLY",
      nextDueDate: isoDaysFromNow(10),
    },
    // Overdue state, and no category (the column is optional).
    {
      userId,
      accountId: checking.id,
      categoryId: null,
      name: "Car insurance",
      amount: "-120.00",
      frequency: "QUARTERLY",
      nextDueDate: isoDaysFromNow(-5),
    },
  ]);
  console.log("Seeded demo subscriptions.");
}

async function main() {
  await db
    .insert(categoryType)
    .values([{ name: "INCOME" }, { name: "EXPENSE" }])
    .onConflictDoNothing();
  const types = Object.fromEntries(
    (await db.select().from(categoryType)).map((t) => [t.name, t.id]),
  );

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL));
  if (existing) {
    console.log("Demo user already present.");
    await seedSubscriptions(existing.id);
    return;
  }

  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, firstName: "Demo", lastName: "User" })
    .returning();

  const [checking] = await db
    .insert(accounts)
    .values([
      {
        userId: user.id,
        slug: "everyday-checking",
        name: "Everyday Checking",
        type: "CHECKING",
      },
      {
        userId: user.id,
        slug: "rainy-day-savings",
        name: "Rainy Day Savings",
        type: "SAVINGS",
      },
      // Archived state: closed card kept for history.
      {
        userId: user.id,
        slug: "old-store-card",
        name: "Old Store Card",
        type: "CREDIT_CARD",
        archivedAt: new Date(),
      },
    ])
    .returning();

  const [salary, groceries, rent, fun] = await db
    .insert(categories)
    .values([
      { userId: user.id, name: "Salary", typeId: types.INCOME },
      { userId: user.id, name: "Groceries", typeId: types.EXPENSE },
      { userId: user.id, name: "Rent", typeId: types.EXPENSE },
      { userId: user.id, name: "Fun money", typeId: types.EXPENSE }, // empty state: budgeted, nothing spent
    ])
    .returning();

  const [food, home] = await db
    .insert(budgets)
    .values([
      // Covers two categories; "Fun money" has nothing spent yet (empty state).
      { userId: user.id, name: "Food & fun", month, amount: "650.00" },
      { userId: user.id, name: "Rent", month, amount: "1400.00" },
    ])
    .returning();
  await db.insert(budgetCategories).values([
    { budgetId: food.id, categoryId: groceries.id },
    { budgetId: food.id, categoryId: fun.id },
    { budgetId: home.id, categoryId: rent.id },
  ]);

  await db.insert(transactions).values([
    {
      userId: user.id,
      accountId: checking.id,
      categoryId: salary.id,
      amount: "3200.00",
      name: "Paycheck",
      date: day(1),
    },
    {
      userId: user.id,
      accountId: checking.id,
      categoryId: rent.id,
      amount: "-1400.00",
      name: "Rent",
      date: day(2),
    },
    {
      userId: user.id,
      accountId: checking.id,
      categoryId: groceries.id,
      amount: "-86.42",
      name: "Grocery run",
      date: day(3),
    },
    {
      userId: user.id,
      accountId: checking.id,
      categoryId: null,
      amount: "-12.00",
      name: "Uncategorized coffee",
      date: day(4),
    },
  ]);

  await seedSubscriptions(user.id);
  console.log(`Seeded ${DEMO_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
