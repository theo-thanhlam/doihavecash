"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  /** The body: usually a form. */
  children: ReactNode;
  /** Buttons along the bottom. A submit button outside the form uses `form="<form id>"`. */
  actions?: ReactNode;
  /** Called on Esc or a backdrop click. Unmount the modal to close it. */
  onClose: () => void;
};

/**
 * A daisyUI modal that opens as soon as it's rendered:
 *
 *   {open && <Modal title="Add account" actions={…} onClose={() => setOpen(false)}>…</Modal>}
 *
 * It renders into <body>, so styles of whatever opened it (a table cell, a
 * menu) never leak in, and unmounting it resets whatever it holds.
 */
export function Modal({ title, children, actions, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Guard: React's dev double-run would otherwise call showModal twice.
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="modal-box">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        {actions && <div className="modal-action flex-wrap">{actions}</div>}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close">close</button>
      </form>
    </dialog>,
    document.body,
  );
}
