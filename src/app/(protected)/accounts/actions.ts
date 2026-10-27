"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { createAccount, newAccountSchema } from "@/lib/accounts";

export type AddAccountState = ApiResponse<{ slug: string }> | null;

export async function addAccount(
  _prev: AddAccountState,
  form: FormData,
): Promise<AddAccountState> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const parsed = newAccountSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    const slug = await createAccount(user.sub, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return ok({ slug }, `${parsed.data.name} added.`, 201);
  } catch (err) {
    console.error("Adding account failed", err);
    return fail(500, "We couldn't save the account. Try again.");
  }
}
