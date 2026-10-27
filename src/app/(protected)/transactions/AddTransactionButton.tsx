"use client";

import type { ComponentProps } from "react";
import { AddTransactionModal } from "../dashboard/AddTransactionModal";

/** The page's "+ Add Transaction" button and its modal. */
export function AddTransactionButton(
  props: Pick<
    ComponentProps<typeof AddTransactionModal>,
    "accounts" | "categories"
  >,
) {
  return (
    <AddTransactionModal
      {...props}
      trigger={(open) => (
        <button
          type="button"
          className="btn btn-soft btn-accent"
          onClick={open}
        >
          + Add Transaction
        </button>
      )}
    />
  );
}
