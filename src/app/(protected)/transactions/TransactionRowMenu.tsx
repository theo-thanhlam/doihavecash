"use client";

import { useRef, useState, type ComponentProps } from "react";
import {
  AddTransactionModal,
  type EditableTransaction,
} from "../dashboard/AddTransactionModal";
import { DeleteTransactionDialog } from "../dashboard/DeleteTransactionDialog";

type Props = Pick<
  ComponentProps<typeof AddTransactionModal>,
  "accounts" | "categories"
> & { transaction: EditableTransaction };

/** "⋮" menu for one row: Edit opens the transaction modal, Delete asks first. */
export function TransactionRowMenu({ transaction, ...lists }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const closeMenu = () => menu.current?.removeAttribute("open");

  return (
    <>
      <AddTransactionModal
        {...lists}
        transaction={transaction}
        trigger={(open) => (
          <details ref={menu} className="dropdown dropdown-end">
            <summary
              className="btn btn-ghost btn-sm btn-square"
              aria-label={`Actions for ${transaction.name}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </summary>
            <ul className="menu dropdown-content z-10 w-36 rounded-box bg-base-100 p-2 shadow">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    open();
                  }}
                >
                  Edit
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setConfirmingDelete(true);
                  }}
                >
                  Delete
                </button>
              </li>
            </ul>
          </details>
        )}
      />
      {confirmingDelete && (
        <DeleteTransactionDialog
          transaction={transaction}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
