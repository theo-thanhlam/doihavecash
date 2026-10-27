export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold">
      <svg
        viewBox="0 0 32 32"
        className="size-8"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="28" height="28" rx="7" strokeWidth="2.5" />
        <path
          d="M9 17l5 5 9-11"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">DoIHaveMoney</span>
    </span>
  );
}
