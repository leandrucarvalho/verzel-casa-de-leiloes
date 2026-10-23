"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const navLink = "text-sm text-muted hover:text-ink";

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          Casa de Leilões
        </Link>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/" className={navLink}>
            Vitrine
          </Link>
          {user?.role === "bidder" && (
            <>
              <Link href="/carteira" className={navLink}>
                Carteira
              </Link>
              <Link href="/arremates" className={navLink}>
                Meus arremates
              </Link>
            </>
          )}
          {user?.role === "auctioneer" && (
            <Link href="/painel" className={navLink}>
              Painel do leiloeiro
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {loading ? null : user ? (
            <>
              <span className="text-sm text-muted">
                {user.nickname} · {user.role === "auctioneer" ? "leiloeiro" : "licitante"}
              </span>
              <button type="button" onClick={logout} className="text-sm underline underline-offset-4">
                Sair
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={navLink}>
                Entrar
              </Link>
              <Link href="/cadastro" className="rounded-full bg-brass px-4 py-1.5 text-sm font-medium text-brass-ink">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
