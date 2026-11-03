/**
 * The site's navigation: its links, the one of the page shown marked as current.
 *
 * @module
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The site's sections. */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog/first-light", label: "Blog" },
  { href: "/about", label: "About" }
] as const;

/** The navigation. */
export const SiteNav = (): ReactNode => {
  const pathname = usePathname();
  return (
    <nav aria-label="Site" className="flex items-center gap-4 border-b border-slate-200 pb-3">
      <Image src="/anchor.svg" alt="" width={24} height={24} />
      <span className="font-semibold text-harbour">{process.env.HARBOUR_NAME}</span>
      <ul className="flex gap-3">
        {LINKS.map((link) => {
          const section = `/${link.href.split("/")[1] ?? ""}`;
          const isCurrent = section === "/" ? pathname === "/" : pathname.startsWith(section);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isCurrent ? "page" : undefined}
                className={isCurrent ? "font-semibold text-harbour underline" : "text-slate-600"}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
