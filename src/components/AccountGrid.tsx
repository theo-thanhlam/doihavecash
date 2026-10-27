import { accountTypeLabel, formatMoney, type AccountType } from "@/lib/format";

type Account = {
  slug: string;
  name: string;
  type: AccountType;
  balance: string;
};

export function AccountGrid({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <div className="card card-border mt-6">
        <div className="card-body">
          You don&apos;t have any open accounts yet.
        </div>
      </div>
    );
  }
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {accounts.map((a) => (
        <li key={a.slug} className="card card-border">
          <div className="card-body">
            <span className="badge badge-ghost badge-sm">
              {accountTypeLabel[a.type]}
            </span>
            <h2 className="card-title">{a.name}</h2>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(a.balance)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
