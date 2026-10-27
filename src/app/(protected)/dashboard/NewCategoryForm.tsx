"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { CreatedCategory } from "@/lib/categories";
import { addCategory } from "./actions";

type Props = {
  onCreated: (category: CreatedCategory) => void;
  onCancel: () => void;
};

/**
 * Lives inside the transaction form, so it has no <form> of its own and its
 * fields have no `name` (they aren't sent with the transaction).
 */
export function NewCategoryForm({ onCreated, onCancel }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const res = await addCategory({ name, type });
      if (res.data) {
        toast.success(res.message);
        onCreated(res.data);
      } else {
        setError(res.message);
      }
    });

  return (
    <div className="card card-border">
      <div className="card-body gap-3 p-4">
        <div
          className="join w-full"
          role="radiogroup"
          aria-label="Category type"
        >
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={`btn join-item btn-sm flex-1 ${type === t ? "btn-active" : ""}`}
              onClick={() => setType(t)}
            >
              {t === "EXPENSE" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
        <input
          className="input input-sm w-full"
          aria-label="New category name"
          placeholder="e.g. Eating out"
          maxLength={120}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Enter would submit the transaction form instead.
            if (e.key === "Enter") {
              e.preventDefault();
              if (name.trim() && !pending) add();
            }
          }}
        />
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={add}
            disabled={pending || !name.trim()}
          >
            {pending && <span className="loading loading-spinner loading-xs" />}
            Add category
          </button>
        </div>
      </div>
    </div>
  );
}
