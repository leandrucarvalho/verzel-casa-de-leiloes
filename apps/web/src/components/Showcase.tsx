"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lot, LotStatus } from "@/lib/types";
import { LotCard } from "./LotCard";

const tabs: { id: LotStatus; label: string; empty: string }[] = [
  { id: "live", label: "Ao vivo", empty: "Nenhum lote ao vivo agora." },
  { id: "scheduled", label: "Agendados", empty: "Nenhum lote agendado." },
  { id: "ended", label: "Encerrados", empty: "Nenhum lote encerrado ainda." },
];

const POLL_MS = 10_000;

export function Showcase() {
  const [tab, setTab] = useState<LotStatus>("live");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{ key: string; lots: Lot[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // debounce the search box
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // results belong to the tab/search they were fetched for; anything else shows the skeleton
  const key = `${tab}|${search}`;
  const lots = data?.key === key ? data.lots : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ status: tab });
        if (search) params.set("q", search);
        const fetched = await api<Lot[]>(`/lots?${params}`);
        if (cancelled) return;
        setData({ key, lots: fetched });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Não foi possível carregar os lotes.");
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tab, search, key, attempt]);

  const current = tabs.find((t) => t.id === tab)!;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Leilões</h1>
          <p className="mt-1 text-muted">Dê lances ao vivo e confira o histórico de cada lote.</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Buscar lotes pelo título</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título"
            className="w-full rounded-full border border-line bg-surface px-4 py-2 outline-none focus:border-brass"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Fase dos lotes" className="mt-6 flex gap-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-brass text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6">
        {error && !lots ? (
          <div role="alert" className="rounded-xl border border-line bg-surface p-6">
            <p className="text-danger">{error}</p>
            <button onClick={() => setAttempt((n) => n + 1)} className="mt-3 text-sm underline underline-offset-4">
              Tentar de novo
            </button>
          </div>
        ) : !lots ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-line/60" />
            ))}
          </div>
        ) : lots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
            {search ? `Nada encontrado para “${search}”.` : current.empty}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {lots.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
