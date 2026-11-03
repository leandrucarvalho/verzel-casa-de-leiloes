"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";

// Gate for pages that only make sense for one role; the API enforces the same rule.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;
  if (!user) {
    return (
      <p className="card p-5">
        <Link href="/login" className="link font-semibold">
          Entre
        </Link>{" "}
        para ver esta página.
      </p>
    );
  }
  if (user.role !== role) {
    return <p className="card p-5 text-muted">Esta página é para {role === "bidder" ? "licitantes" : "leiloeiros"}.</p>;
  }
  return <>{children}</>;
}
