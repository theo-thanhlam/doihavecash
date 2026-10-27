import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountGrid } from "@/components/AccountGrid";
import { listOpenAccountsWithBalance } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { AddAccountModal } from "./AddAccountModal";

export const metadata: Metadata = { title: "Accounts · DoIHaveMoney" };

async function Accounts() {
  const user = await requireUser("/accounts");
  const rows = await listOpenAccountsWithBalance(user.sub);

  return (
    <div className="w-full px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p>Where your money sits: checking, savings, cash and cards.</p>
        </div>
        <AddAccountModal />
      </div>
      <AccountGrid accounts={rows} />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Accounts />
    </Suspense>
  );
}
