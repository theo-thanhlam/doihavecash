"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

/** A Modal asking "are you sure?" with Cancel and a red confirm button. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
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
            type="button"
            className="btn btn-error"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && <span className="loading loading-spinner loading-sm" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
