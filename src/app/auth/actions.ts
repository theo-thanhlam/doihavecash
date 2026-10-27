"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok, type ApiResponse } from "@/lib/api-response";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import {
  clearSessionCookies,
  findUserByEmail,
  issueSession,
  revokeRefreshToken,
  writeSessionCookies,
} from "@/lib/auth/session";
import { REFRESH_COOKIE } from "@/lib/auth/tokens";
import { safeNext } from "@/lib/safe-next";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));
const name = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(100);
const mode = z.enum(["signin", "signup"]);

const sendSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("signin"), email }),
  z.object({
    mode: z.literal("signup"),
    email,
    firstName: name("First name"),
    lastName: name("Last name"),
  }),
]);

const verifySchema = z.object({
  mode,
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  next: z.string().optional(),
});

export type AuthState = ApiResponse<{
  step: "code" | "needs_signup";
  email: string;
}> | null;

const fields = (form: FormData) => Object.fromEntries(form.entries());

export async function sendCode(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = sendSchema.safeParse(fields(form));
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  try {
    // Sign in with an unknown email: skip the code and go straight to sign up.
    // Trade-off: this reveals whether an email has an account.
    if (
      parsed.data.mode === "signin" &&
      !(await findUserByEmail(parsed.data.email))
    ) {
      return {
        status: 404,
        message: "No account uses this email yet. Add your name to sign up.",
        data: { step: "needs_signup", email: parsed.data.email },
      };
    }
    const result = await requestOtp(parsed.data.email);
    if (result === "too_soon")
      return fail(
        429,
        "A code was just sent. Wait a minute before asking again.",
      );
  } catch (err) {
    console.error("Sending sign-in code failed", err);
    return fail(
      503,
      "We couldn't send the code right now. Try again in a minute.",
    );
  }
  return ok(
    { step: "code", email: parsed.data.email },
    `We sent a code to ${parsed.data.email}.`,
  );
}

export async function verifyCode(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = verifySchema.safeParse(fields(form));
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const input = parsed.data;

  let result;
  try {
    result = await verifyOtp(input.email, input.code);
  } catch (err) {
    console.error("Checking sign-in code failed", err);
    return fail(
      503,
      "We couldn't check the code right now. Try again in a minute.",
    );
  }
  const again = { step: "code" as const, email: input.email };
  if (result === "invalid")
    return {
      status: 401,
      message: "That code is wrong. Check the email and try again.",
      data: again,
    };
  if (result === "expired")
    return {
      status: 410,
      message: "That code expired. Ask for a new one.",
      data: again,
    };
  if (result === "locked")
    return {
      status: 429,
      message: "Too many wrong tries. Ask for a new code.",
      data: again,
    };

  let user = await findUserByEmail(input.email);
  if (!user && input.mode === "signin") {
    return {
      status: 404,
      message: "No account uses this email yet. Add your name to sign up.",
      data: { step: "needs_signup", email: input.email },
    };
  }
  if (!user) {
    const names = z
      .object({ firstName: name("First name"), lastName: name("Last name") })
      .safeParse(input);
    if (!names.success) return fail(400, names.error.issues[0].message);
    // A parallel sign-up may have created the user; then we just sign in.
    await db
      .insert(users)
      .values({ email: input.email, ...names.data })
      .onConflictDoNothing({ target: users.email });
    user = await findUserByEmail(input.email);
    if (!user) return fail(409, "This email belongs to a closed account.");
  }

  writeSessionCookies(await cookies(), await issueSession(user));
  redirect(safeNext(input.next));
}

export async function signOut() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) await revokeRefreshToken(refresh);
  clearSessionCookies(jar);
  redirect("/");
}
