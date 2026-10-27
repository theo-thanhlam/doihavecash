import { randomInt, timingSafeEqual } from "node:crypto";
import { getRedis } from "@/lib/redis";
import { sendOtpEmail } from "@/lib/mail";
import { sha256 } from "./tokens";

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

const keys = (email: string) => ({
  code: `otp:code:${email}`,
  attempts: `otp:attempts:${email}`,
  cooldown: `otp:cooldown:${email}`,
});

export type RequestOtpResult = "sent" | "too_soon";
export type VerifyOtpResult = "ok" | "invalid" | "expired" | "locked";

/** Emails a fresh 6-digit code. Any previous code for this email stops working. */
export async function requestOtp(
  email: string,
  send = sendOtpEmail,
): Promise<RequestOtpResult> {
  const redis = await getRedis();
  const k = keys(email);
  const allowed = await redis.set(k.cooldown, "1", {
    NX: true,
    EX: OTP_RESEND_SECONDS,
  });
  if (!allowed) return "too_soon";

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await redis
    .multi()
    .set(k.code, sha256(`${email}:${code}`), { EX: OTP_TTL_SECONDS })
    .del(k.attempts)
    .exec();
  try {
    await send(email, code);
  } catch (err) {
    // Let the user retry right away instead of waiting out the cooldown.
    await redis.del([k.code, k.cooldown]);
    throw err;
  }
  return "sent";
}

/** Checks a code. A correct code works once; 5 wrong tries burns it. */
export async function verifyOtp(
  email: string,
  code: string,
): Promise<VerifyOtpResult> {
  const redis = await getRedis();
  const k = keys(email);

  const attempts = await redis.incr(k.attempts);
  if (attempts === 1) await redis.expire(k.attempts, OTP_TTL_SECONDS);
  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(k.code);
    return "locked";
  }

  const stored = await redis.get(k.code);
  if (!stored) return "expired";

  const given = Buffer.from(sha256(`${email}:${code}`));
  if (!timingSafeEqual(given, Buffer.from(stored))) return "invalid";

  // DEL returns 0 if a parallel request already used this code.
  const removed = await redis.del(k.code);
  if (removed !== 1) return "expired";
  await redis.del(k.attempts);
  return "ok";
}
