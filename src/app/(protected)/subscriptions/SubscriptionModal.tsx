"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { frequencyLabel, type Frequency } from "@/lib/format";
import { CategoryField, type CategoryOption } from "../dashboard/CategoryField";
import { saveSubscription, type SubscriptionState } from "./actions";

type Lists = {
  accounts: { slug: string; name: string }[];
  categories: CategoryOption[];
};

/** Pass this for edit mode. `amount` is positive; the category decides the sign. */
export type EditableSubscription = {
  id: string;
  name: string;
  categoryId: string;
  amount: string;
  accountSlug: string;
  frequency: Frequency;
  nextDueDate: string;
};

type Props = Lists & {
  subscription?: EditableSubscription;
  /** Renders whatever opens the modal (a button, a menu item...). */
  trigger: (open: () => void) => ReactNode;
};

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const frequencies = Object.keys(frequencyLabel) as Frequency[];
const localToday = () => new Date().toLocaleDateString("en-CA");

export function SubscriptionModal({ trigger, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      {open && <SubscriptionDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function SubscriptionDialog({
  accounts,
  categories,
  subscription,
  onClose,
}: Omit<Props, "trigger"> & { onClose: () => void }) {
  const formId = useId();
  const toast = useToast();
  const [values, setValues] = useState({
    name: subscription?.name ?? "",
    categoryId: subscription?.categoryId ?? "",
    amount: subscription?.amount ?? "",
    accountSlug: subscription?.accountSlug ?? accounts[0]?.slug ?? "",
    frequency: subscription?.frequency ?? ("MONTHLY" as Frequency),
    nextDueDate: subscription?.nextDueDate ?? localToday(),
  });
  const [error, setError] = useState<string | null>(null);
  const set =
    (key: keyof typeof values) => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const [, submit, pending] = useActionState(
    async (prev: SubscriptionState, form: FormData) => {
      const res = await saveSubscription(prev, form);
      if (res && res.status < 300) {
        toast.success(res.message);
        onClose();
      } else if (res) {
        setError(res.message);
      }
      return res;
    },
    null,
  );

  const complete =
    values.name.trim() !== "" &&
    values.categoryId !== "" &&
    AMOUNT.test(values.amount) &&
    Number(values.amount) > 0 &&
    values.accountSlug !== "" &&
    values.nextDueDate !== "";

  return (
    <Modal
      title={subscription ? "Edit subscription" : "Add subscription"}
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          {accounts.length > 0 && (
            <button
              type="submit"
              form={formId}
              className="btn btn-primary"
              disabled={pending || !complete}
            >
              {pending && (
                <span className="loading loading-spinner loading-sm" />
              )}
              Submit
            </button>
          )}
        </>
      }
    >
      {accounts.length === 0 ? (
        <p>Open an account first, then you can add subscriptions to it.</p>
      ) : (
        <form id={formId} action={submit} className="flex flex-col gap-4">
          {subscription && (
            <input type="hidden" name="id" value={subscription.id} />
          )}

          <label className="flex flex-col gap-1">
            <span>Name</span>
            <input
              name="name"
              className="input w-full"
              placeholder="e.g. Netflix, Car insurance"
              required
              maxLength={120}
              autoComplete="off"
              value={values.name}
              onChange={set("name")}
            />
          </label>

          <CategoryField
            categories={categories}
            value={values.categoryId}
            onChange={(categoryId) => setValues((v) => ({ ...v, categoryId }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span>Amount</span>
              <input
                name="amount"
                className="input w-full tabular-nums"
                inputMode="decimal"
                placeholder="0.00"
                pattern="\d{1,12}(\.\d{1,2})?"
                title="An amount like 12.50"
                required
                value={values.amount}
                onChange={(e) =>
                  setValues((v) => ({ ...v, amount: e.target.value.trim() }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>How often</span>
              <select
                name="frequency"
                className="select w-full"
                value={values.frequency}
                onChange={set("frequency")}
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {frequencyLabel[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span>Next due date</span>
              <input
                type="date"
                name="nextDueDate"
                className="input w-full"
                required
                value={values.nextDueDate}
                onChange={set("nextDueDate")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Account</span>
              <select
                name="accountSlug"
                className="select w-full"
                required
                value={values.accountSlug}
                onChange={set("accountSlug")}
              >
                {accounts.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div role="alert" className="alert alert-error alert-soft">
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

/** The page's "+ Add subscription" button and its modal. */
export function AddSubscriptionButton(props: Lists) {
  return (
    <SubscriptionModal
      {...props}
      trigger={(open) => (
        <button
          type="button"
          className="btn btn-soft btn-accent"
          onClick={open}
        >
          + Add subscription
        </button>
      )}
    />
  );
}
