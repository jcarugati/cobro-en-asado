"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const TABS = [
  { href: "/", label: "Tu sueldo" },
  { href: "/asado", label: "Armá tu asado" },
  { href: "/juego", label: "¿Más o menos?" },
];

export function activeTab(pathname: string) {
  if (pathname === "/asado" || pathname.startsWith("/c/a/")) return "/asado";
  if (pathname === "/juego" || pathname.startsWith("/c/j/")) return "/juego";
  return "/";
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = activeTab(pathname);

  return (
    <nav className={pending ? "tabs tabs-pending" : "tabs"} aria-label="Secciones">
      {TABS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="tab"
          aria-current={active === href ? "page" : undefined}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            // A full load would forget the pay in memory.ts.
            event.preventDefault();
            if (pathname !== href) start(() => router.push(href));
          }}
        >
          {label}
        </a>
      ))}
      {/* Next's announcer often fires before the title lands, so it reads the first h1 or nothing. This names the tab, and may double with it. Empty on a share page, or tapping its own tab would change nothing to announce. */}
      <p className="sr-only" aria-live="polite">{pathname.startsWith("/c/") ? "" : TABS.find(({ href }) => href === active)?.label}</p>
    </nav>
  );
}
