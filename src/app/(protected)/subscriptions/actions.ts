"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createRecurring,
  recurringIdSchema,
  recurringSchema,
  removeRecurring,
  updateRecurring,
} from "@/lib/recurring";

export type SubscriptionState = ApiResponse<{ id: string }> | null;

const refresh = () => {
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
};

/** Adds a subscription, or updates one when the form has an `id`. */
export async function saveSubscription(
  _prev: SubscriptionState,
  form: FormData,
): Promise<SubscriptionState> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");

  const { id: rawId, ...fields } = Object.fromEntries(form);
  const parsed = recurringSchema.safeParse(fields);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  const id =
    rawId !== undefined && rawId !== ""
      ? recurringIdSchema.safeParse(rawId)
      : null;
  if (id && !id.success) return fail(400, id.error.issues[0].message);

  try {
    const saved = id
      ? await updateRecurring(user.sub, id.data, parsed.data)
      : await createRecurring(user.sub, parsed.data);
    if (!saved) {
      return fail(
        422,
        "That subscription, account or category isn't available. Refresh and try again.",
      );
    }
    refresh();
    return id
      ? ok({ id: saved }, `${parsed.data.name} updated.`)
      : ok({ id: saved }, `${parsed.data.name} added.`, 201);
  } catch (err) {
    console.error("Saving subscription failed", err);
    return fail(500, "We couldn't save the subscription. Try again.");
  }
}

export async function removeSubscription(
  id: string,
): Promise<ApiResponse<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Your session ended. Sign in again.");
  const parsed = recurringIdSchema.safeParse(id);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    if (!(await removeRecurring(user.sub, parsed.data))) {
      return fail(404, "That subscription no longer exists.");
    }
    refresh();
    return ok({ id: parsed.data }, "Subscription removed.");
  } catch (err) {
    console.error("Removing subscription failed", err);
    return fail(500, "We couldn't remove it. Try again.");
  }
}
