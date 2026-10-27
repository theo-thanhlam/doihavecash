"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendCode, verifyCode, type AuthState } from "./actions";

type Mode = "signin" | "signup";
type Step = "details" | "code";
const toneClass = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
} as const;

export function AuthForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [, submit, pending] = useActionState(
    async (prev: AuthState, form: FormData) => {
      const res =
        form.get("intent") === "verify"
          ? await verifyCode(prev, form)
          : await sendCode(prev, form);
      if (!res) return res;
      const tone =
        res.data?.step === "needs_signup"
          ? "info"
          : res.status < 300
            ? "success"
            : "error";
      setNotice({ tone, text: res.message });
      if (res.data?.step === "code") setStep("code");
      if (res.data?.step === "needs_signup") {
        setMode("signup");
        setStep("details");
      }
      setCode("");
      return res;
    },
    null,
  );

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("details");
    setNotice(null);
  };

  return (
    <>
      <div role="tablist" className="tabs tabs-box mb-2">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`tab flex-1 ${mode === m ? "tab-active" : ""}`}
            onClick={() => switchMode(m)}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <h1 className="text-2xl font-bold">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="text-sm">
        {step === "details"
          ? "We'll email you a 6-digit code. No password needed."
          : `Enter the code we sent to ${email}.`}
      </p>

      {notice && (
        <div
          role="alert"
          aria-live="polite"
          className={`alert alert-soft ${toneClass[notice.tone]} mt-2`}
        >
          <span>{notice.text}</span>
        </div>
      )}

      <form action={submit} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && step === "details" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="floating-label">
              <span>First name</span>
              <input
                className="input w-full"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={100}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="floating-label">
              <span>Last name</span>
              <input
                className="input w-full"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={100}
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
        )}
        {mode === "signup" && step === "code" && (
          <>
            <input type="hidden" name="firstName" value={firstName} />
            <input type="hidden" name="lastName" value={lastName} />
          </>
        )}

        {step === "details" ? (
          <label className="floating-label">
            <span>Email</span>
            <input
              className="input w-full"
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="email" value={email} />
            <label className="floating-label">
              <span>6-digit code</span>
              <input
                className="input w-full text-center font-mono text-xl tracking-[0.5em]"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}

        <button
          type="submit"
          name="intent"
          value={step === "code" ? "verify" : "send"}
          className="btn btn-primary"
          disabled={pending}
        >
          {pending && <span className="loading loading-spinner loading-sm" />}
          {step === "code"
            ? mode === "signin"
              ? "Sign in"
              : "Create account"
            : "Email me a code"}
        </button>

        {step === "code" && (
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="link"
              onClick={() => {
                setStep("details");
                setNotice(null);
              }}
            >
              Use a different email
            </button>
            <button
              type="submit"
              name="intent"
              value="send"
              formNoValidate
              className="link"
              disabled={pending}
            >
              Send a new code
            </button>
          </div>
        )}
      </form>
    </>
  );
}
