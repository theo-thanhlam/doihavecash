import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { sha256, signAccessToken, verifyAccessToken } from "./tokens";
import { safeNext } from "@/lib/safe-next";

describe("access tokens", () => {
  it("round-trips the user's id and name", async () => {
    const token = await signAccessToken({
      sub: "user-1",
      name: "Ada Lovelace",
    });
    expect(await verifyAccessToken(token)).toEqual({
      sub: "user-1",
      name: "Ada Lovelace",
    });
  });

  it("rejects missing, tampered, wrongly signed, and expired tokens", async () => {
    const token = await signAccessToken({ sub: "user-1", name: "Ada" });
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "admin", name: "x" }),
    ).toString("base64url");
    const otherKey = new TextEncoder().encode("x".repeat(40));
    const foreign = await new SignJWT({ name: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("1h")
      .sign(otherKey);
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expired = await new SignJWT({ name: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${p}.`;

    for (const bad of [
      undefined,
      "",
      "garbage",
      `${h}.${forgedPayload}.${s}`,
      foreign,
      expired,
      unsigned,
    ]) {
      expect(await verifyAccessToken(bad)).toBeNull();
    }
  });

  it("hashes refresh tokens deterministically", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).toHaveLength(64);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths and blocks open redirects", () => {
    expect(safeNext("/dashboard?x=1")).toBe("/dashboard?x=1");
    for (const bad of [
      undefined,
      null,
      "",
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "dashboard",
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
