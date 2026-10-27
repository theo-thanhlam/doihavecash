"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** A daisyUI <details> dropdown that closes itself when the page changes. */
export function NavDropdown({
  summary,
  summaryClassName,
  label,
  children,
}: {
  summary: ReactNode;
  summaryClassName: string;
  label?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);

  return (
    <details ref={ref} className="dropdown dropdown-end">
      <summary className={summaryClassName} aria-label={label}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
