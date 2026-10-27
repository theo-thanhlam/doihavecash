"use client";

import { useId, useState } from "react";
import type { CreatedCategory } from "@/lib/categories";
import { NewCategoryForm } from "./NewCategoryForm";

export type CategoryOption = { id: string; name: string; type: string };

const groups = [
  { type: "EXPENSE", label: "Expense" },
  { type: "INCOME", label: "Income" },
];

/**
 * Category picker grouped by Expense / Income, with "+ New category".
 * Submits as `categoryId`. New categories show up right away and get selected.
 */
export function CategoryField({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  // Categories created here, until the page reloads with them.
  const [created, setCreated] = useState<CategoryOption[]>([]);
  const all = [
    ...categories,
    ...created.filter((c) => !categories.some((p) => p.id === c.id)),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const onCreated = (c: CreatedCategory) => {
    setCreated((list) => [...list, { id: c.id, name: c.name, type: c.type }]);
    onChange(c.id);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id}>Category</label>
        {!adding && (
          <button
            type="button"
            className="link text-sm"
            onClick={() => setAdding(true)}
          >
            + New category
          </button>
        )}
      </div>
      <select
        id={id}
        name="categoryId"
        className="select w-full"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {all.length ? "Pick a category" : "No categories yet"}
        </option>
        {groups.map((g) => {
          const options = all.filter((c) => c.type === g.type);
          return options.length ? (
            <optgroup key={g.type} label={g.label}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {adding && (
        <NewCategoryForm
          onCreated={onCreated}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
