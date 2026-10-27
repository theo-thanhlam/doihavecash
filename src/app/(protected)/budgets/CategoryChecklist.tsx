"use client";

import { useId, useState } from "react";
import type { CreatedCategory } from "@/lib/categories";
import type { CategoryOption } from "../dashboard/CategoryField";
import { NewCategoryForm } from "../dashboard/NewCategoryForm";

/**
 * Dropdown for picking several expense categories. Selected ones are
 * highlighted (primary = blue in the corporate theme) and submit as
 * `categoryIds`. A category made with "+ New category" is selected for you.
 *
 * The list opens inline, not as a floating panel, so the modal's scroll
 * area can't cut it off.
 */
export function CategoryChecklist({
  categories,
  selected,
  onChange,
}: {
  categories: CategoryOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const labelId = useId();
  const [adding, setAdding] = useState(false);
  // Categories created here, until the page reloads with them.
  const [created, setCreated] = useState<CategoryOption[]>([]);
  const all = [
    ...categories,
    ...created.filter((c) => !categories.some((p) => p.id === c.id)),
  ]
    .filter((c) => c.type === "EXPENSE")
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  const onCreated = (c: CreatedCategory) => {
    setCreated((list) => [...list, { id: c.id, name: c.name, type: c.type }]);
    if (c.type === "EXPENSE" && !selected.includes(c.id))
      onChange([...selected, c.id]);
    setAdding(false);
  };

  const names = all.filter((c) => selected.includes(c.id)).map((c) => c.name);

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId}>Categories</span>

      {/* Buttons don't submit values, so the picks travel as hidden inputs. */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}

      <details className="w-full">
        <summary className="select w-full list-none" aria-labelledby={labelId}>
          <span className="truncate">
            {names.length ? names.join(", ") : "Pick categories"}
          </span>
        </summary>

        <div
          role="group"
          aria-labelledby={labelId}
          className="card card-border mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto p-2"
        >
          {all.length === 0 && (
            <p className="p-2">No expense categories yet.</p>
          )}
          {all.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                className={`btn btn-sm justify-start ${on ? "btn-primary" : "btn-ghost"}`}
                onClick={() => toggle(c.id)}
              >
                {on && <span aria-hidden="true">✓</span>}
                {c.name}
              </button>
            );
          })}
          {!adding && (
            <button
              type="button"
              className="btn btn-sm btn-ghost justify-start"
              onClick={() => setAdding(true)}
            >
              + New category
            </button>
          )}
          {adding && (
            <NewCategoryForm
              onCreated={onCreated}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      </details>

      <span className="text-sm">{selected.length} selected</span>
    </div>
  );
}
