"use client";

import { useActionState, useId, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { accountTypeLabel, type AccountType } from "@/lib/format";
import { addAccount, type AddAccountState } from "./actions";

const types = Object.keys(accountTypeLabel) as AccountType[];

export function AddAccountModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-soft btn-accent"
        onClick={() => setOpen(true)}
      >
        + Add Account
      </button>
      {open && <AddAccountDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [error, setError] = useState<string | null>(null);

  const [, submit, pending] = useActionState(
    async (prev: AddAccountState, form: FormData) => {
      const res = await addAccount(prev, form);
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

  return (
    <Modal
      title="Add account"
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
            disabled={pending || !name.trim()}
          >
            {pending && <span className="loading loading-spinner loading-sm" />}
            Add account
          </button>
        </>
      }
    >
      <form id={formId} action={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Account name</span>
          <input
            name="name"
            className="input w-full"
            placeholder="e.g. Everyday Checking"
            required
            maxLength={120}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Type</span>
          <select
            name="type"
            className="select w-full"
            required
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {accountTypeLabel[t]}
              </option>
            ))}
          </select>
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
