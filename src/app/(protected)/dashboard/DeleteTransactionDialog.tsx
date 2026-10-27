"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { deleteTransaction } from "./actions";

/** "Delete this transaction?" modal. Calls onDeleted after a successful delete. */
export function DeleteTransactionDialog({
  transaction,
  onClose,
  onDeleted = onClose,
}: {
  transaction: { id: string; name: string };
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await deleteTransaction(transaction.id);
      if (res.status < 300) {
        toast.success(res.message);
        onDeleted();
      } else {
        setError(res.message);
      }
    });

  return (
    <ConfirmDialog
      title="Delete transaction?"
      pending={pending}
      onConfirm={confirm}
      onClose={onClose}
    >
      <p>
        &ldquo;{transaction.name}&rdquo; will be removed and stop counting
        toward balances and budgets.
      </p>
      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3">
          <span>{error}</span>
        </div>
      )}
    </ConfirmDialog>
  );
}
