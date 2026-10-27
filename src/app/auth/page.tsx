import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in · DoIHaveMoney" };

export default function AuthPage() {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <div className="card card-border w-full max-w-md">
        <div className="card-body">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
