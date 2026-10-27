import type { Metadata } from "next";
import { Suspense } from "react";
import { listOpenAccountsWithBalance } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, frequencyLabel } from "@/lib/format";
import { listActiveRecurring } from "@/lib/recurring";
import { listCategoriesForUser } from "@/lib/transactions";
import { AddSubscriptionButton } from "./SubscriptionModal";
import { SubscriptionRowMenu } from "./SubscriptionRowMenu";

export const metadata: Metadata = { title: "Subscriptions · DoIHaveMoney" };

async function Subscriptions() {
  const user = await requireUser("/subscriptions");
  const [rows, accounts, categories] = await Promise.all([
    listActiveRecurring(user.sub),
    listOpenAccountsWithBalance(user.sub),
    listCategoriesForUser(user.sub),
  ]);

  return (
    <div className="w-full px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p>Bills and income that repeat, so you see them coming.</p>
        </div>
        <AddSubscriptionButton accounts={accounts} categories={categories} />
      </div>

      {rows.length === 0 ? (
        <div className="card card-border mt-6">
          <div className="card-body">
            No subscriptions yet. Add rent, insurance or streaming so you see
            them coming.
          </div>
        </div>
      ) : (
        <div className="card card-border mt-6">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="hidden md:table-cell">
                  How often
                </th>
                <th scope="col" className="hidden lg:table-cell">
                  Account
                </th>
                <th scope="col" className="hidden lg:table-cell">
                  Category
                </th>
                <th scope="col">Next due</th>
                <th scope="col" className="text-right">
                  Amount
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="hidden whitespace-nowrap md:table-cell">
                    {frequencyLabel[r.frequency]}
                  </td>
                  <td className="hidden lg:table-cell">{r.account_name}</td>
                  <td className="hidden lg:table-cell">
                    {r.category_name ?? "Uncategorized"}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {formatDate(r.next_due_date)}
                      {r.overdue && (
                        <span className="badge badge-error badge-sm">
                          Overdue
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(r.amount)}
                  </td>
                  <td className="w-0">
                    <SubscriptionRowMenu
                      accounts={accounts}
                      categories={categories}
                      subscription={{
                        id: r.id,
                        name: r.name,
                        categoryId: r.category_id ?? "",
                        amount: r.amount.replace(/^-/, ""),
                        accountSlug: r.account_slug,
                        frequency: r.frequency,
                        nextDueDate: r.next_due_date,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Subscriptions />
    </Suspense>
  );
}
