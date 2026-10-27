"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createCategory,
  newCategorySchema,
  type CreatedCategory,
} from "@/lib/categories";
import {
  createTransaction,
  deleteTransaction as removeTransaction,
  transactionIdSchema,
  transactionSchema,
  updateTransaction,
} from "@/lib/transactions";

export type TransactionState = ApiResponse<{ id: string }> | null;

const refresh = () => {
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
};

/** Adds a transaction, or updates one when the form has an `id`. */
export async function saveTransaction(
  _prev: TransactionState,
  form: FormData,
): Promise<TransactionState> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const { id: rawId, ...fields } = Object.fromEntries(form);
  const parsed = transactionSchema.safeParse(fields);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  const editing = rawId !== undefined && rawId !== "";
  const id = editing ? transactionIdSchema.safeParse(rawId) : null;
  if (id && !id.success) return fail(400, id.error.issues[0].message);

  try {
    const saved = id
      ? await updateTransaction(user.sub, id.data, parsed.data)
      : await createTransaction(user.sub, parsed.data);
    if (!saved) {
      return fail(
        422,
        "That transaction, account or category isn't available. Refresh and try again.",
      );
    }
    refresh();
    return id
      ? ok({ id: saved }, "Transaction updated.")
      : ok({ id: saved }, "Transaction added.", 201);
  } catch (err) {
    console.error("Saving transaction failed", err);
    return fail(500, "We couldn't save the transaction. Try again.");
  }
}

export async function deleteTransaction(
  id: string,
): Promise<ApiResponse<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const parsed = transactionIdSchema.safeParse(id);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    if (!(await removeTransaction(user.sub, parsed.data))) {
      return fail(404, "That transaction no longer exists.");
    }
    refresh();
    return ok({ id: parsed.data }, "Transaction deleted.");
  } catch (err) {
    console.error("Deleting transaction failed", err);
    return fail(500, "We couldn't delete the transaction. Try again.");
  }
}

export async function addCategory(input: {
  name: string;
  type: string;
}): Promise<ApiResponse<CreatedCategory>> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const parsed = newCategorySchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    const category = await createCategory(user.sub, parsed.data);
    refresh();
    return category.existed
      ? ok(category, `"${category.name}" already exists, so it's selected.`)
      : ok(category, `Category "${category.name}" added.`, 201);
  } catch (err) {
    console.error("Adding category failed", err);
    return fail(500, "We couldn't save the category. Try again.");
  }
}
