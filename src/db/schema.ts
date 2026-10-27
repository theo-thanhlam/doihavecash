// Mirrors TableDesign/v6/schema.dbml. Change that file (and get approval) first.
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  date,
  numeric,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const ts = () => timestamp({ withTimezone: true });

const timestamps = {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: ts()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const base = { ...timestamps, deletedAt: ts() };

// Money: exact decimals, read back as strings so no float rounding.
const money = () => numeric({ precision: 14, scale: 2 });

export const accountType = pgEnum("account_type", [
  "CASH",
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
]);

export const users = pgTable("users", {
  ...base,
  firstName: varchar({ length: 100 }).notNull(),
  lastName: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 320 }).notNull().unique(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    ...timestamps,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar({ length: 64 }).notNull().unique(),
    expiresAt: ts().notNull(),
    revokedAt: ts(),
    replacedById: uuid().references((): AnyPgColumn => refreshTokens.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index().on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    ...base,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar({ length: 120 }).notNull(),
    name: varchar({ length: 120 }).notNull(),
    type: accountType().notNull(),
    archivedAt: ts(),
  },
  (t) => [uniqueIndex().on(t.userId, t.slug)],
);

export const categoryType = pgTable("category_type", {
  ...base,
  name: varchar({ length: 50 }).notNull().unique(),
});

export const categories = pgTable("categories", {
  ...base,
  name: varchar({ length: 120 }).notNull(),
  typeId: uuid()
    .notNull()
    .references(() => categoryType.id),
  userId: uuid().references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid().references((): AnyPgColumn => categories.id),
});

// A spending limit for one month across one or more expense categories.
// used % = spent in those categories that month / amount (the desired amount).
export const budgets = pgTable(
  "budgets",
  {
    ...base,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar({ length: 120 }).notNull(),
    month: date().notNull(),
    amount: money().notNull(),
  },
  (t) => [index().on(t.userId, t.month)],
);

// Which categories a budget covers (many-to-many).
export const budgetCategories = pgTable(
  "budget_categories",
  {
    ...timestamps,
    budgetId: uuid()
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id),
  },
  (t) => [uniqueIndex().on(t.budgetId, t.categoryId), index().on(t.categoryId)],
);

export const transactions = pgTable(
  "transactions",
  {
    ...base,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid().references(() => categories.id),
    amount: money().notNull(),
    name: varchar({ length: 120 }).notNull(),
    note: varchar({ length: 1000 }),
    date: date().notNull(),
  },
  (t) => [
    index().on(t.userId, t.date),
    index().on(t.accountId),
    index().on(t.categoryId),
  ],
);

export const frequency = pgEnum("frequency", [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

// A schedule, not money moved. "Mark paid" records a normal transaction and
// moves nextDueDate forward. amount is signed: negative = outflow.
export const recurringPayments = pgTable(
  "recurring_payments",
  {
    ...base,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid().references(() => categories.id),
    name: varchar({ length: 120 }).notNull(),
    amount: money().notNull(),
    frequency: frequency().notNull(),
    nextDueDate: date().notNull(),
    endedAt: ts(),
  },
  (t) => [index().on(t.userId, t.nextDueDate)],
);
