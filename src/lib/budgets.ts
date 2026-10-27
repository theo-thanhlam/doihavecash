import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";

export const budgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a budget name.")
    .max(120, "Keep the name under 120 characters."),
  categoryIds: z
    .array(z.uuid({ message: "Pick categories from the list." }))
    .min(1, "Pick at least one category.")
    .max(50, "Pick at most 50 categories.")
    .transform((ids) => [...new Set(ids)]),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 250.00.")
    .refine((v) => Number(v) > 0, "Amount must be more than 0."),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

/**
 * Creates this month's budget covering the given expense categories (the
 * user's own or system defaults). The budget and its category links are
 * written in one statement; if any category isn't allowed, nothing is saved.
 * Returns the budget id, or null.
 */
export async function createBudget(userId: string, input: BudgetInput) {
  const ids = sql.join(
    input.categoryIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const { rows } = await db.execute<{ budget_id: string }>(sql`
    WITH allowed AS (
      SELECT c.id FROM categories c
      JOIN category_type ct ON ct.id = c.type_id
      WHERE c.id IN (${ids})
        AND (c.user_id = ${userId} OR c.user_id IS NULL)
        AND c.deleted_at IS NULL
        AND ct.name = 'EXPENSE'
    ),
    budget AS (
      INSERT INTO budgets (user_id, name, month, amount)
      SELECT ${userId}, ${input.name}, date_trunc('month', current_date)::date, ${input.amount}::numeric
      WHERE (SELECT count(*) FROM allowed) = ${input.categoryIds.length}
      RETURNING id
    )
    INSERT INTO budget_categories (budget_id, category_id)
    SELECT budget.id, allowed.id FROM budget CROSS JOIN allowed
    RETURNING budget_id
  `);
  return rows[0]?.budget_id ?? null;
}
