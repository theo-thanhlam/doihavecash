"use client";

import { useRef, useState, useTransition, type ComponentProps } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { removeSubscription } from "./actions";
import {
  SubscriptionModal,
  type EditableSubscription,
} from "./SubscriptionModal";

type Props = Pick<
  ComponentProps<typeof SubscriptionModal>,
  "accounts" | "categories"
> & { subscription: EditableSubscription };

/** "⋮" menu for one table row: Edit opens the modal, Remove asks first. */
export function SubscriptionRowMenu({ subscription, ...lists }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, start] = useTransition();
  const closeMenu = () => menu.current?.removeAttribute("open");

  const closeConfirm = () => {
    setConfirming(false);
    setError(null);
  };

  const remove = () =>
    start(async () => {
      const res = await removeSubscription(subscription.id);
      if (res.status < 300) {
        toast.success(res.message);
        closeConfirm();
      } else {
        setError(res.message);
      }
    });

  return (
    <>
      <SubscriptionModal
        {...lists}
        subscription={subscription}
        trigger={(open) => (
          <details ref={menu} className="dropdown dropdown-end">
            <summary
              className="btn btn-ghost btn-sm btn-square"
              aria-label={`Actions for ${subscription.name}`}
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
                    setConfirming(true);
                  }}
                >
                  Remove
                </button>
              </li>
            </ul>
          </details>
        )}
      />
      {confirming && (
        <ConfirmDialog
          title="Remove subscription?"
          confirmLabel="Remove"
          pending={removing}
          onConfirm={remove}
          onClose={closeConfirm}
        >
          <p>
            &ldquo;{subscription.name}&rdquo; will no longer show up as coming
            due. Past transactions stay.
          </p>
          {error && (
            <div role="alert" className="alert alert-error alert-soft mt-3">
              <span>{error}</span>
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
