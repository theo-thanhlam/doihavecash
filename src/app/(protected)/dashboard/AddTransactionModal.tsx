"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CategoryField, type CategoryOption } from "./CategoryField";
import { DeleteTransactionDialog } from "./DeleteTransactionDialog";
import { saveTransaction, type TransactionState } from "./actions";

/** Pass this to open the modal in edit mode. `amount` is positive; the category decides the sign. */
export type EditableTransaction = {
  id: string;
  name: string;
  categoryId: string;
  amount: string;
  accountSlug: string;
  note: string | null;
};

type Props = {
  accounts: { slug: string; name: string }[];
  categories: CategoryOption[];
  transaction?: EditableTransaction;
  /** Renders what opens the modal. Defaults to "+ Add transaction" (or "Edit"). */
  trigger?: (open: () => void) => ReactNode;
};

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

/** Today in the user's own timezone, as YYYY-MM-DD. */
const localToday = () => new Date().toLocaleDateString("en-CA");

/** "+ Add transaction" button, or "Edit" when given a transaction, plus its modal. */
export function AddTransactionModal({ trigger, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : props.transaction ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen(true)}
        >
          Edit
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-soft btn-accent"
          aria-label="Add transaction"
          onClick={() => setOpen(true)}
        >
          + <span className="hidden md:block">Add transaction</span>
        </button>
      )}
      {open && <TransactionDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function TransactionDialog({
  accounts,
  categories,
  transaction,
  onClose,
}: Omit<Props, "trigger"> & { onClose: () => void }) {
  const formId = useId();
  const toast = useToast();
  const [values, setValues] = useState({
    name: transaction?.name ?? "",
    categoryId: transaction?.categoryId ?? "",
    amount: transaction?.amount ?? "",
    accountSlug: transaction?.accountSlug ?? accounts[0]?.slug ?? "",
    note: transaction?.note ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const set =
    (key: keyof typeof values) => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const [, submit, saving] = useActionState(
    async (prev: TransactionState, form: FormData) => {
      form.set("date", localToday());
      const res = await saveTransaction(prev, form);
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

  const busy = saving;
  const complete =
    values.name.trim() !== "" &&
    values.categoryId !== "" &&
    AMOUNT.test(values.amount) &&
    Number(values.amount) > 0 &&
    values.accountSlug !== "";

  return (
    <Modal
      title={transaction ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
      actions={
        <>
          {transaction && (
            <button
              type="button"
              className="btn btn-error btn-outline mr-auto"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          {accounts.length > 0 && (
            <button
              type="submit"
              form={formId}
              className="btn btn-primary"
              disabled={busy || !complete}
            >
              {saving && (
                <span className="loading loading-spinner loading-sm" />
              )}
              Submit
            </button>
          )}
        </>
      }
    >
      {accounts.length === 0 ? (
        <p>Open an account first, then you can add transactions to it.</p>
      ) : (
        <form id={formId} action={submit} className="flex flex-col gap-4">
          {transaction && (
            <input type="hidden" name="id" value={transaction.id} />
          )}

          <label className="flex flex-col gap-1">
            <span>Transaction name</span>
            <input
              name="name"
              className="input w-full"
              placeholder="e.g. Grocery run"
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

          <label className="flex flex-col gap-1">
            <span>
              Note <span className="font-normal">(optional)</span>
            </span>
            <textarea
              name="note"
              className="textarea w-full"
              rows={2}
              maxLength={1000}
              value={values.note}
              onChange={set("note")}
            />
          </label>

          {error && (
            <div role="alert" className="alert alert-error alert-soft">
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
      {transaction && confirmingDelete && (
        <DeleteTransactionDialog
          transaction={transaction}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onClose}
        />
      )}
    </Modal>
  );
}
