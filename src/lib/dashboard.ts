import { sql } from "drizzle-orm";
import { db } from "@/db";

// shortcut: "this month" uses the database's clock, not the user's timezone;
// pass the user's date in if people near midnight on the 1st see the wrong month.

export type RecentTransaction = {
  id: string;
  name: string;
  amount: string;
  date: string;
  category_name: string | null;
  account_name: string;
};

export async function listRecentTransactions(userId: string, limit = 5) {
  const { rows } = await db.execute<RecentTransaction>(sql`
    SELECT t.id, t.name, t.amount::text, t.date::text,
           c.name AS category_name, a.name AS account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId} AND t.deleted_at IS NULL
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ${limit}
  `);
  return rows;
}

export type BudgetProgress = {
  id: string;
  name: string;
  assigned: string;
  spent: string;
};

/**
 * This month's budgets. spent = money spent this month across all of the
 * budget's categories (each transaction has one category, so none count twice).
 */
export async function listBudgetProgress(userId: string) {
  const { rows } = await db.execute<BudgetProgress>(sql`
    SELECT b.id, b.name, b.amount::text AS assigned,
           coalesce((
             SELECT -sum(t.amount)
             FROM transactions t
             JOIN budget_categories bc ON bc.category_id = t.category_id
             WHERE bc.budget_id = b.id
               AND t.user_id = b.user_id AND t.deleted_at IS NULL AND t.amount < 0
               AND t.date >= b.month AND t.date < b.month + interval '1 month'
           ), 0)::text AS spent
    FROM budgets b
    WHERE b.user_id = ${userId} AND b.deleted_at IS NULL
      AND b.month = date_trunc('month', current_date)::date
    ORDER BY b.name
  `);
  return rows;
}

/** Percent of a budget used, rounded. 0 when nothing was assigned. */
export const percentUsed = (b: BudgetProgress) =>
  Number(b.assigned) > 0
    ? Math.round((Number(b.spent) / Number(b.assigned)) * 100)
    : 0;

export type MonthTotal = { month: string; total: string };

/** Money spent (outflows) per month for the last `months` months, oldest first, zero-filled. */
export async function listMonthlyExpenses(userId: string, months = 6) {
  const { rows } = await db.execute<MonthTotal>(sql`
    SELECT to_char(m, 'YYYY-MM') AS month, coalesce(-sum(t.amount), 0)::text AS total
    FROM generate_series(
      date_trunc('month', current_date) - make_interval(months => ${months - 1}),
      date_trunc('month', current_date),
      interval '1 month'
    ) AS m
    LEFT JOIN transactions t
      ON t.user_id = ${userId} AND t.deleted_at IS NULL AND t.amount < 0
     AND t.date >= m AND t.date < m + interval '1 month'
    GROUP BY m
    ORDER BY m
  `);
  return rows;
}
