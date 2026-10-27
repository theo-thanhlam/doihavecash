"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { budgetSchema, createBudget } from "@/lib/budgets";

export type BudgetState = ApiResponse<{ id: string }> | null;

export async function saveBudget(
  _prev: BudgetState,
  form: FormData,
): Promise<BudgetState> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const parsed = budgetSchema.safeParse({
    name: form.get("name"),
    amount: form.get("amount"),
    categoryIds: form.getAll("categoryIds"),
  });
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    const id = await createBudget(user.sub, parsed.data);
    if (!id) {
      return fail(
        422,
        "Budgets can only use your expense categories. Refresh and pick again.",
      );
    }
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return ok({ id }, `${parsed.data.name} budget added.`, 201);
  } catch (err) {
    console.error("Saving budget failed", err);
    return fail(500, "We couldn't save the budget. Try again.");
  }
}
