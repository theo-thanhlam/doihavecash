/** Only allow redirects to paths on this site (blocks //evil.com and /\evil.com). */
export const safeNext = (next?: string | null) =>
  next &&
  next.startsWith("/") &&
  !next.startsWith("//") &&
  !next.startsWith("/\\")
    ? next
    : "/";
