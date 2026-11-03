"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/lotes") : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-medium transition-colors ${
        active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-1 px-4">
        <Link href="/" className="flex min-h-14 items-center gap-2.5" aria-label="Casa de Leilões, página inicial">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink">
            <Icon name="gavel" size={20} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Casa de Leilões</span>
        </Link>

        <nav aria-label="Principal" className="flex flex-wrap items-center gap-x-6">
          <NavLink href="/">Vitrine</NavLink>
          {user?.role === "bidder" && (
            <>
              <NavLink href="/carteira">Carteira</NavLink>
              <NavLink href="/arremates">Meus arremates</NavLink>
            </>
          )}
          {user?.role === "auctioneer" && <NavLink href="/painel">Painel do leiloeiro</NavLink>}
        </nav>

        <div className="ml-auto flex items-center gap-2 py-2">
          <ThemeToggle />
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {user.nickname} · {user.role === "auctioneer" ? "leiloeiro" : "licitante"}
              </span>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm">
                Sair
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Entrar
              </Link>
              <Link href="/cadastro" className="btn btn-brand btn-sm">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
