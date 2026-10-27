import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, categoryType } from "@/db/schema";

/** Categories this user may use: their own plus system defaults. */
export function listCategoriesForUser(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categoryType.name,
    })
    .from(categories)
    .innerJoin(categoryType, eq(categoryType.id, categories.typeId))
    .where(
      and(
        or(eq(categories.userId, userId), isNull(categories.userId)),
        isNull(categories.deletedAt),
      ),
    )
    .orderBy(asc(categories.name));
}

export const transactionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a transaction name.")
    .max(120, "Keep the name under 120 characters."),
  categoryId: z.uuid({ message: "Pick a category." }),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 12.50.")
    .refine((v) => Number(v) > 0, "Amount must be more than 0."),
  accountSlug: z.string().trim().min(1, "Pick an account."),
  note: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1000 characters.")
    .optional()
    .transform((v) => v || null),
  date: z.iso.date({ message: "Enter a valid date." }),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const transactionIdSchema = z.uuid({ message: "Unknown transaction." });

// Shared checks: the account is the user's and open; the category is the
// user's or a system default. Income vs expense comes from the category, and
// expenses are stored negative.
export const ownedAccountAndCategory = (
  userId: string,
  input: { accountSlug: string; categoryId: string },
) => sql`
  FROM accounts a
  CROSS JOIN categories c
  JOIN category_type ct ON ct.id = c.type_id
  WHERE a.slug = ${input.accountSlug}
    AND a.user_id = ${userId}
    AND a.archived_at IS NULL AND a.deleted_at IS NULL
    AND c.id = ${input.categoryId}
    AND (c.user_id = ${userId} OR c.user_id IS NULL)
    AND c.deleted_at IS NULL`;

export const signedAmount = (input: { amount: string }) =>
  sql`CASE WHEN ct.name = 'EXPENSE' THEN -${input.amount}::numeric ELSE ${input.amount}::numeric END`;

/** Saves a new transaction. Returns its id, or null when a check fails. */
export async function createTransaction(
  userId: string,
  input: TransactionInput,
) {
  const { rows } = await db.execute<{ id: string }>(sql`
    INSERT INTO transactions (user_id, account_id, category_id, amount, name, note, date)
    SELECT ${userId}, a.id, c.id, ${signedAmount(input)}, ${input.name}, ${input.note}, ${input.date}::date
    ${ownedAccountAndCategory(userId, input)}
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}

/**
 * Updates one of the user's transactions. The date is left as it was.
 * Returns the id, or null when the transaction or a check fails.
 */
export async function updateTransaction(
  userId: string,
  id: string,
  input: TransactionInput,
) {
  const { rows } = await db.execute<{ id: string }>(sql`
    UPDATE transactions t
    SET account_id = a.id, category_id = c.id, amount = ${signedAmount(input)},
        name = ${input.name}, note = ${input.note}, updated_at = now()
    ${ownedAccountAndCategory(userId, input)}
      AND t.id = ${id} AND t.user_id = ${userId} AND t.deleted_at IS NULL
    RETURNING t.id
  `);
  return rows[0]?.id ?? null;
}

/** Soft-deletes one of the user's transactions. Returns false if it wasn't theirs or is already gone. */
export async function deleteTransaction(userId: string, id: string) {
  const { rows } = await db.execute(sql`
    UPDATE transactions SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  `);
  return rows.length === 1;
}

export type TransactionRow = {
  id: string;
  name: string;
  amount: string;
  date: string;
  note: string | null;
  category_id: string | null;
  category_name: string | null;
  account_slug: string;
  account_name: string;
};

// shortcut: newest `limit` rows only, no paging; add paging when people pass a few hundred.
/** The user's transactions, newest first, with what the edit modal needs. */
export async function listTransactions(userId: string, limit = 200) {
  const { rows } = await db.execute<TransactionRow>(sql`
    SELECT t.id, t.name, t.amount::text, t.date::text, t.note,
           t.category_id, c.name AS category_name,
           a.slug AS account_slug, a.name AS account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId} AND t.deleted_at IS NULL
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ${limit}
  `);
  return rows;
}
