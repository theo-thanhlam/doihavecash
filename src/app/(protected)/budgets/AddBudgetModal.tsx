"use client";

import { useActionState, useId, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import type { CategoryOption } from "../dashboard/CategoryField";
import { saveBudget, type BudgetState } from "./actions";
import { CategoryChecklist } from "./CategoryChecklist";

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

export function AddBudgetModal({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-soft btn-accent"
        onClick={() => setOpen(true)}
      >
        + Add budget
      </button>
      {open && (
        <BudgetDialog categories={categories} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function BudgetDialog({
  categories,
  onClose,
}: {
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const formId = useId();
  const toast = useToast();
  const [name, setName] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [, submit, pending] = useActionState(
    async (prev: BudgetState, form: FormData) => {
      const res = await saveBudget(prev, form);
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
    name.trim() !== "" &&
    categoryIds.length > 0 &&
    AMOUNT.test(amount) &&
    Number(amount) > 0;

  return (
    <Modal
      title="Add budget"
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
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={pending || !complete}
          >
            {pending && <span className="loading loading-spinner loading-sm" />}
            Submit
          </button>
        </>
      }
    >
      <form id={formId} action={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Budget name</span>
          <input
            name="name"
            className="input w-full"
            placeholder="e.g. Food, Going out"
            required
            maxLength={120}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <CategoryChecklist
          categories={categories}
          selected={categoryIds}
          onChange={setCategoryIds}
        />

        <label className="flex flex-col gap-1">
          <span>Desired amount for this month</span>
          <input
            name="amount"
            className="input w-full tabular-nums"
            inputMode="decimal"
            placeholder="0.00"
            pattern="\d{1,12}(\.\d{1,2})?"
            title="An amount like 250.00"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
          />
        </label>

        {error && (
          <div role="alert" className="alert alert-error alert-soft">
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
