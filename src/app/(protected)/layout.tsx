import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";

// Every page in app/(protected) needs a signed-in user. The proxy redirects
// first (keeping the return path); this server check is the backstop.
// Pages that load user data should still call requireUser() themselves,
// since layouts don't re-run on every client-side navigation.
async function Guard({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <div className="skeleton h-40 w-full" />
        </div>
      }
    >
      <Guard>{children}</Guard>
    </Suspense>
  );
}
