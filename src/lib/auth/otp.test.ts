import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getRedis } from "@/lib/redis";
import { OTP_MAX_ATTEMPTS, requestOtp, verifyOtp } from "./otp";

const emails: string[] = [];
const freshEmail = () => {
  const e = `otp-${randomBytes(4).toString("hex")}@test.local`;
  emails.push(e);
  return e;
};

/** Requests a code and returns what would have been emailed. */
async function codeFor(email: string) {
  let sent = "";
  expect(await requestOtp(email, async (_to, code) => void (sent = code))).toBe(
    "sent",
  );
  return sent;
}

afterAll(async () => {
  const redis = await getRedis();
  for (const e of emails)
    await redis.del([
      `otp:code:${e}`,
      `otp:attempts:${e}`,
      `otp:cooldown:${e}`,
    ]);
  await redis.quit();
});

describe("email one-time codes", () => {
  it("accepts the right code once", async () => {
    const email = freshEmail();
    const code = await codeFor(email);
    expect(code).toMatch(/^\d{6}$/);
    expect(await verifyOtp(email, code)).toBe("ok");
    expect(await verifyOtp(email, code)).toBe("expired");
  });

  it("stores the code with a 5 minute expiry, hashed", async () => {
    const email = freshEmail();
    const code = await codeFor(email);
    const redis = await getRedis();
    const ttl = await redis.ttl(`otp:code:${email}`);
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
    expect(await redis.get(`otp:code:${email}`)).not.toContain(code);
  });

  it("burns the code after too many wrong tries", async () => {
    const email = freshEmail();
    const code = await codeFor(email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++)
      expect(await verifyOtp(email, wrong)).toBe("invalid");
    expect(await verifyOtp(email, wrong)).toBe("invalid");
    expect(await verifyOtp(email, code)).toBe("locked");
  });

  it("limits resends and lets you retry when the email fails", async () => {
    const email = freshEmail();
    await codeFor(email);
    expect(await requestOtp(email, async () => {})).toBe("too_soon");

    const other = freshEmail();
    await expect(
      requestOtp(other, async () => Promise.reject(new Error("smtp down"))),
    ).rejects.toThrow("smtp down");
    expect(await requestOtp(other, async () => {})).toBe("sent");
  });

  it("only lets one of two parallel checks use the code", async () => {
    const email = freshEmail();
    const code = await codeFor(email);
    const results = await Promise.all([
      verifyOtp(email, code),
      verifyOtp(email, code),
    ]);
    expect(results.sort()).toEqual(["expired", "ok"]);
  });
});
