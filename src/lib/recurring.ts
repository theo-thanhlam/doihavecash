import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { frequency } from "@/db/schema";
import type { Frequency } from "./format";
import { ownedAccountAndCategory, signedAmount } from "./transactions";

export const recurringSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(120, "Keep the name under 120 characters."),
  categoryId: z.uuid({ message: "Pick a category." }),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 12.50.")
    .refine((v) => Number(v) > 0, "Amount must be more than 0."),
  accountSlug: z.string().trim().min(1, "Pick an account."),
  frequency: z.enum(frequency.enumValues, { message: "Pick how often." }),
  nextDueDate: z.iso.date({ message: "Pick the next due date." }),
});
export type RecurringInput = z.infer<typeof recurringSchema>;

export const recurringIdSchema = z.uuid({ message: "Unknown subscription." });

/**
 * Saves a schedule. Same ownership checks as a transaction; the amount is
 * stored negative for expense categories. Returns the id, or null.
 */
export async function createRecurring(userId: string, input: RecurringInput) {
  const { rows } = await db.execute<{ id: string }>(sql`
    INSERT INTO recurring_payments (user_id, account_id, category_id, name, amount, frequency, next_due_date)
    SELECT ${userId}, a.id, c.id, ${input.name}, ${signedAmount(input)},
           ${input.frequency}::frequency, ${input.nextDueDate}::date
    ${ownedAccountAndCategory(userId, input)}
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}

export type RecurringRow = {
  id: string;
  name: string;
  amount: string;
  frequency: Frequency;
  next_due_date: string;
  account_name: string;
  category_name: string | null;
  account_slug: string;
  category_id: string | null;
  overdue: boolean;
};

/** Active schedules (not cancelled), soonest first. */
export async function listActiveRecurring(userId: string, limit = 100) {
  const { rows } = await db.execute<RecurringRow>(sql`
    SELECT r.id, r.name, r.amount::text, r.frequency, r.next_due_date::text,
           a.name AS account_name, a.slug AS account_slug,
           c.name AS category_name, r.category_id,
           r.next_due_date < current_date AS overdue
    FROM recurring_payments r
    JOIN accounts a ON a.id = r.account_id
    LEFT JOIN categories c ON c.id = r.category_id
    WHERE r.user_id = ${userId} AND r.ended_at IS NULL AND r.deleted_at IS NULL
    ORDER BY r.next_due_date, r.name
    LIMIT ${limit}
  `);
  return rows;
}

// shortcut: month steps from the last due date, so a 31st drifts to the 28th
// after February; store an anchor day if users complain.
const step = sql`CASE r.frequency
  WHEN 'WEEKLY' THEN interval '1 week'
  WHEN 'MONTHLY' THEN interval '1 month'
  WHEN 'QUARTERLY' THEN interval '3 months'
  ELSE interval '1 year' END`;

// Not wired to the UI right now (the "Mark paid" button was removed); kept
// because it's the tested way to turn a schedule into a real transaction.
/**
 * "Mark paid": records a transaction for the current due amount (dated
 * `paidOn`) and moves the schedule to its next due date, in one statement.
 * Returns the new transaction id, or null if the schedule isn't the user's,
 * is cancelled, or its account is archived.
 */
export async function markRecurringPaid(
  userId: string,
  id: string,
  paidOn: string,
) {
  const { rows } = await db.execute<{ id: string }>(sql`
    WITH due AS (
      UPDATE recurring_payments r
      SET next_due_date = (r.next_due_date + ${step})::date, updated_at = now()
      FROM accounts a
      WHERE r.id = ${id} AND r.user_id = ${userId}
        AND r.ended_at IS NULL AND r.deleted_at IS NULL
        AND a.id = r.account_id AND a.archived_at IS NULL AND a.deleted_at IS NULL
      RETURNING r.user_id, r.account_id, r.category_id, r.name, r.amount
    )
    INSERT INTO transactions (user_id, account_id, category_id, amount, name, date)
    SELECT user_id, account_id, category_id, amount, name, ${paidOn}::date FROM due
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}

/**
 * Updates one of the user's active schedules, with the same checks as
 * creating one. Returns the id, or null.
 */
export async function updateRecurring(
  userId: string,
  id: string,
  input: RecurringInput,
) {
  const { rows } = await db.execute<{ id: string }>(sql`
    UPDATE recurring_payments r
    SET account_id = a.id, category_id = c.id, name = ${input.name},
        amount = ${signedAmount(input)}, frequency = ${input.frequency}::frequency,
        next_due_date = ${input.nextDueDate}::date, updated_at = now()
    ${ownedAccountAndCategory(userId, input)}
      AND r.id = ${id} AND r.user_id = ${userId}
      AND r.ended_at IS NULL AND r.deleted_at IS NULL
    RETURNING r.id
  `);
  return rows[0]?.id ?? null;
}

/** Removes (soft-deletes) a schedule. Past transactions stay. */
export async function removeRecurring(userId: string, id: string) {
  const { rows } = await db.execute(sql`
    UPDATE recurring_payments SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  `);
  return rows.length === 1;
}
