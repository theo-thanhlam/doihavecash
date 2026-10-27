import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, accountType, transactions } from "@/db/schema";

/** Open accounts for one user, each with its balance (sum of its transactions). */
export function listOpenAccountsWithBalance(userId: string) {
  return db
    .select({
      slug: accounts.slug,
      name: accounts.name,
      type: accounts.type,
      balance: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, accounts.id),
        isNull(transactions.deletedAt),
      ),
    )
    .where(
      and(
        eq(accounts.userId, userId),
        isNull(accounts.archivedAt),
        isNull(accounts.deletedAt),
      ),
    )
    .groupBy(accounts.id)
    .orderBy(asc(accounts.name));
}

export const newAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter an account name.")
    .max(120, "Keep the name under 120 characters."),
  type: z.enum(accountType.enumValues, { message: "Pick an account type." }),
});
export type NewAccount = z.infer<typeof newAccountSchema>;

/** "Joint Checking!" -> "joint-checking". Falls back to "account". */
export function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
  return slug || "account";
}

/** Creates an account with a slug unique for this user (adds -2, -3… on clashes). */
export async function createAccount(userId: string, input: NewAccount) {
  const base = slugify(input.name);
  // A parallel insert can take the slug we picked; the unique index stops it, so try again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = new Set(
      (
        await db
          .select({ slug: accounts.slug })
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              or(eq(accounts.slug, base), like(accounts.slug, `${base}-%`)),
            ),
          )
      ).map((r) => r.slug),
    );
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const [row] = await db
      .insert(accounts)
      .values({ userId, slug, name: input.name, type: input.type })
      .onConflictDoNothing({ target: [accounts.userId, accounts.slug] })
      .returning({ slug: accounts.slug });
    if (row) return row.slug;
  }
  throw new Error("Could not find a free account slug");
}
