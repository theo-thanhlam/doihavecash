import type { Metadata } from "next";
import { Suspense } from "react";
import { listOpenAccountsWithBalance } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { listCategoriesForUser, listTransactions } from "@/lib/transactions";
import { AddTransactionButton } from "./AddTransactionButton";
import { TransactionRowMenu } from "./TransactionRowMenu";

export const metadata: Metadata = { title: "Transactions · DoIHaveMoney" };

async function Transactions() {
  const user = await requireUser("/transactions");
  const [rows, accounts, categories] = await Promise.all([
    listTransactions(user.sub),
    listOpenAccountsWithBalance(user.sub),
    listCategoriesForUser(user.sub),
  ]);

  return (
    <div className="w-full px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p>Everything that came in or went out, newest first.</p>
        </div>
        <AddTransactionButton accounts={accounts} categories={categories} />
      </div>

      {rows.length === 0 ? (
        <div className="card card-border mt-6">
          <div className="card-body">
            No transactions yet. Add your first one to start tracking.
          </div>
        </div>
      ) : (
        // No sideways scroll: it would clip the row menus. Small screens hide extra columns.
        <div className="card card-border mt-6">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Date</th>
                <th scope="col" className="hidden md:table-cell">
                  Category
                </th>
                <th scope="col" className="hidden lg:table-cell">
                  Account
                </th>
                <th scope="col" className="text-right">
                  Amount
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="hidden md:table-cell">
                    {t.category_name ?? "Uncategorized"}
                  </td>
                  <td className="hidden lg:table-cell">{t.account_name}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {formatMoney(t.amount)}
                  </td>
                  <td className="w-0">
                    <TransactionRowMenu
                      accounts={accounts}
                      categories={categories}
                      transaction={{
                        id: t.id,
                        name: t.name,
                        categoryId: t.category_id ?? "",
                        amount: t.amount.replace(/^-/, ""),
                        accountSlug: t.account_slug,
                        note: t.note,
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

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Transactions />
    </Suspense>
  );
}
