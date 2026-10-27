import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { listBudgetProgress, percentUsed } from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";
import { listCategoriesForUser } from "@/lib/transactions";
import { AddBudgetModal } from "./AddBudgetModal";

export const metadata: Metadata = { title: "Budgets · DoIHaveMoney" };

const thisMonth = () =>
  new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

async function Budgets() {
  const user = await requireUser("/budgets");
  const [rows, categories] = await Promise.all([
    listBudgetProgress(user.sub),
    listCategoriesForUser(user.sub),
  ]);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div className="w-full px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p>How much of each budget you&apos;ve used in {thisMonth()}.</p>
        </div>
        <AddBudgetModal categories={expenseCategories} />
      </div>

      {rows.length === 0 ? (
        <div className="card card-border mt-6">
          <div className="card-body">
            No budgets for this month yet. Add one to set a spending limit for a
            category.
          </div>
        </div>
      ) : (
        <div className="card card-border mt-6 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Budget</th>
                <th scope="col">Used</th>
                <th scope="col" className="text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const pct = percentUsed(b);
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{b.name}</td>
                    <td className="w-1/2">
                      <div className="flex items-center gap-3">
                        <progress
                          className={`progress w-full ${pct > 100 ? "progress-error" : "progress-primary"}`}
                          value={Math.min(pct, 100)}
                          max={100}
                          aria-label={`${b.name}: ${pct}% used`}
                        />
                        <span className="w-24 shrink-0 text-right tabular-nums">
                          {pct}%{pct > 100 && " (over)"}
                        </span>
                      </div>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {formatMoney(b.assigned)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Budgets />
    </Suspense>
  );
}
