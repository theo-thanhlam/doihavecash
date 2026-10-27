import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";
import { Logo } from "./Logo";
import { NavDropdown } from "./NavDropdown";

const navLinks = [
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Account" },
  { href: "/budgets", label: "Budget" },
  { href: "/subscriptions", label: "Subscriptions" },
];

const menuClass =
  "menu dropdown-content z-10 mt-2 w-56 rounded-box bg-base-100 p-2 shadow";

function LogoLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="DoIHaveMoney home">
      <Logo />
    </Link>
  );
}

async function SignedInLogo() {
  const user = await getCurrentUser();
  return <LogoLink href={user ? "/dashboard" : "/"} />;
}

/** The button is the menu row itself (so the whole row is clickable) and submits a hidden form. */
function SignOutItem({ formId }: { formId: string }) {
  return (
    <li>
      <form id={formId} action={signOut} hidden />
      <button type="submit" form={formId}>
        Sign out
      </button>
    </li>
  );
}

/** lg and up: name dropdown, or a Sign in button. */
async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/auth" className="btn btn-primary btn-sm">
        Sign in
      </Link>
    );
  }
  return (
    <NavDropdown
      summaryClassName="btn btn-sm max-w-48 btn-outline"
      summary={<span className="truncate">{user.name}</span>}
    >
      <ul className={menuClass}>
        <li>
          <Link href="/dashboard">Dashboard</Link>
        </li>
        <SignOutItem formId="sign-out-desktop" />
      </ul>
    </NavDropdown>
  );
}

/** Below lg: the user part of the hamburger menu. */
async function MobileUserItems() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <li>
        <Link href="/auth">Sign in</Link>
      </li>
    );
  }
  return (
    <>
      {" "}
      {navLinks.map((l) => (
        <li key={l.href}>
          <Link href={l.href}>{l.label}</Link>
        </li>
      ))}
      <hr />
      <li className="menu-title truncate">{user.name}</li>
      <SignOutItem formId="sign-out-mobile" />
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

/** Main links, shown only to signed-in users. */
async function MainNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <nav className="navbar-center hidden lg:flex" aria-label="Main">
      <ul className="flex gap-1">
        {navLinks.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="btn btn-ghost btn-sm">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Not async: anything that reads cookies must sit inside <Suspense> (cacheComponents).
export function Header() {
  return (
    <header className="shadow-sm">
      <div className="navbar mx-auto w-full max-w-[1600px] gap-2 px-4">
        <div className="navbar-start">
          <Suspense fallback={<LogoLink href="/" />}>
            <SignedInLogo />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <MainNav />
        </Suspense>

        <div className="navbar-end">
          <div className="hidden lg:block">
            <Suspense fallback={<span className="skeleton h-8 w-20" />}>
              <UserMenu />
            </Suspense>
          </div>
          <div className="lg:hidden">
            <NavDropdown
              summaryClassName="btn btn-ghost btn-square"
              label="Open menu"
              summary={<HamburgerIcon />}
            >
              <ul className={menuClass}>
                <Suspense fallback={<li className="skeleton h-8" />}>
                  <MobileUserItems />
                </Suspense>
              </ul>
            </NavDropdown>
          </div>
        </div>
      </div>
    </header>
  );
}
