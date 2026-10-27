import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LineChart } from "@/components/LineChart";
import { listOpenAccountsWithBalance } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import {
  listBudgetProgress,
  listMonthlyExpenses,
  listRecentTransactions,
  percentUsed,
} from "@/lib/dashboard";
import { formatDate, formatMoney } from "@/lib/format";
import { listActiveRecurring } from "@/lib/recurring";
import { listCategoriesForUser } from "@/lib/transactions";
import { AddTransactionModal } from "./AddTransactionModal";

export const metadata: Metadata = { title: "Dashboard · DoIHaveMoney" };

const monthLabel = (yyyyMm: string) =>
  new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
  });

function Tile({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card card-border ${className}`}>
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

type Row = { id: string; name: string; date: string; amount: string };

/** Name, date and amount as a compact table. */
function MiniTable({ rows, dateLabel }: { rows: Row[]; dateLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">{dateLabel}</th>
            <th scope="col" className="text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="max-w-48 truncate">{r.name}</td>
              <td className="whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="text-right whitespace-nowrap tabular-nums">
                {formatMoney(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-4">{children}</p>
);

async function Dashboard() {
  // The proxy already blocks signed-out visitors; this check keeps the page safe on its own.
  const user = await requireUser();
  const [accounts, categories, recent, budgets, monthly, upcoming] =
    await Promise.all([
      listOpenAccountsWithBalance(user.sub),
      listCategoriesForUser(user.sub),
      listRecentTransactions(user.sub, 5),
      listBudgetProgress(user.sub),
      listMonthlyExpenses(user.sub, 6),
      listActiveRecurring(user.sub, 5),
    ]);

  return (
    <div className="w-full px-4 py-8">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hi, {user.name}</h1>
          <p>Here&apos;s where your money stands this month.</p>
        </div>
        <AddTransactionModal accounts={accounts} categories={categories} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Tile
          title="Recent transactions"
          className="lg:col-span-2"
          action={
            <Link href="/transactions" className="link text-sm">
              See all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Empty>No transactions yet. Add one with the button above.</Empty>
          ) : (
            <MiniTable
              dateLabel="Date"
              rows={recent.map((t) => ({
                id: t.id,
                name: t.name,
                date: t.date,
                amount: t.amount,
              }))}
            />
          )}
        </Tile>

        <Tile title="Budgets this month">
          {budgets.length === 0 ? (
            <Empty>No budgets set for this month.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {budgets.map((b) => {
                const pct = percentUsed(b);
                return (
                  <li key={b.id}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{b.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {pct}%{pct > 100 && " · over"}
                      </span>
                    </div>
                    <progress
                      className={`progress w-full ${pct > 100 ? "progress-error" : "progress-primary"}`}
                      value={Math.min(pct, 100)}
                      max={100}
                      aria-label={`${b.name}: ${pct}% used`}
                    />
                    <p className="text-xs tabular-nums">
                      {formatMoney(b.spent)} of {formatMoney(b.assigned)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Tile>

        <Tile title="Monthly expenses" className="lg:col-span-2">
          <LineChart
            title="Money spent per month, last 6 months"
            points={monthly.map((m) => ({
              label: monthLabel(m.month),
              value: Number(m.total),
            }))}
          />
        </Tile>

        <Tile
          title="Next subscriptions"
          action={
            <Link href="/subscriptions" className="link text-sm">
              See all
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <Empty>
              Nothing scheduled.{" "}
              <Link href="/subscriptions" className="link">
                Add a subscription
              </Link>
              .
            </Empty>
          ) : (
            <MiniTable
              dateLabel="Due"
              rows={upcoming.map((r) => ({
                id: r.id,
                name: r.name,
                date: r.next_due_date,
                amount: r.amount,
              }))}
            />
          )}
        </Tile>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
