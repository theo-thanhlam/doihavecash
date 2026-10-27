import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";

export const CATEGORY_TYPES = ["EXPENSE", "INCOME"] as const;

export const newCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a category name.")
    .max(120, "Keep the name under 120 characters."),
  type: z.enum(CATEGORY_TYPES, { message: "Pick expense or income." }),
});
export type NewCategory = z.infer<typeof newCategorySchema>;

export type CreatedCategory = {
  id: string;
  name: string;
  type: (typeof CATEGORY_TYPES)[number];
  existed: boolean;
};

/**
 * Creates a category for the user. If one with the same name and type already
 * exists (theirs or a system default, ignoring case), returns that instead.
 */
export async function createCategory(
  userId: string,
  input: NewCategory,
): Promise<CreatedCategory> {
  const existing = sql`
    SELECT c.id, c.name FROM categories c
    JOIN category_type ct ON ct.id = c.type_id
    WHERE c.deleted_at IS NULL
      AND (c.user_id = ${userId} OR c.user_id IS NULL)
      AND ct.name = ${input.type}
      AND lower(c.name) = lower(${input.name})
    LIMIT 1`;

  // One statement: insert only when no match exists.
  const { rows } = await db.execute<{ id: string; name: string }>(sql`
    INSERT INTO categories (name, type_id, user_id)
    SELECT ${input.name}, ct.id, ${userId}
    FROM category_type ct
    WHERE ct.name = ${input.type} AND NOT EXISTS (${existing})
    RETURNING id, name
  `);
  if (rows[0]) return { ...rows[0], type: input.type, existed: false };

  const { rows: found } = await db.execute<{ id: string; name: string }>(
    existing,
  );
  if (!found[0])
    throw new Error(`Category type ${input.type} is missing; run the seed`);
  return { ...found[0], type: input.type, existed: true };
}
