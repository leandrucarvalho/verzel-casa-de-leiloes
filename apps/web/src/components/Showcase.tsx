"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { parseBRLToCents } from "@/lib/format";
import type { Lot, LotStatus } from "@/lib/types";
import { LotCard } from "./LotCard";

const tabs: { id: LotStatus; label: string; empty: string }[] = [
  { id: "live", label: "Ao vivo", empty: "Nenhum lote ao vivo agora." },
  { id: "scheduled", label: "Agendados", empty: "Nenhum lote agendado." },
  { id: "ended", label: "Encerrados", empty: "Nenhum lote encerrado ainda." },
];

const sorts = [
  { id: "ending", label: "Termina primeiro" },
  { id: "price_desc", label: "Maior preço" },
  { id: "price_asc", label: "Menor preço" },
  { id: "most_bids", label: "Mais lances" },
] as const;
type Sort = (typeof sorts)[number]["id"];

const POLL_MS = 10_000;
const PAGE_SIZE = 12;
const field = "rounded-lg border border-line bg-surface px-3 py-1.5 outline-none focus:border-brass";

export function Showcase() {
  const [tab, setTab] = useState<LotStatus>("live");
  const [sort, setSort] = useState<Sort>("ending");
  const [query, setQuery] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [applied, setApplied] = useState({ q: "", min: "", max: "" });
  const [data, setData] = useState<{ key: string; lots: Lot[] } | null>(null);
  const [paging, setPaging] = useState({ key: "", pages: 1 });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // debounce the text boxes so we do not query on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setApplied({ q: query.trim(), min: minInput.trim(), max: maxInput.trim() }), 300);
    return () => clearTimeout(id);
  }, [query, minInput, maxInput]);

  // results belong to the tab/filters they were fetched for; anything else shows the skeleton
  const key = `${tab}|${sort}|${applied.q}|${applied.min}|${applied.max}`;
  // "load more" restarts at one page whenever the tab or a filter changes
  const pages = paging.key === key ? paging.pages : 1;
  const visible = pages * PAGE_SIZE;
  const fetched = data?.key === key ? data.lots : null;
  const lots = fetched?.slice(0, visible) ?? null;
  const hasMore = (fetched?.length ?? 0) > visible;
  const filtered = Boolean(applied.q || applied.min || applied.max);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ status: tab, sort, limit: String(visible + 1) });
        if (applied.q) params.set("q", applied.q);
        const min = parseBRLToCents(applied.min);
        const max = parseBRLToCents(applied.max);
        if (min) params.set("minCents", String(min));
        if (max) params.set("maxCents", String(max));
        const result = await api<Lot[]>(`/lots?${params}`);
        if (cancelled) return;
        setData({ key, lots: result });
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
  }, [tab, sort, applied, visible, key, attempt]);

  const current = tabs.find((t) => t.id === tab)!;

  function clearFilters() {
    setQuery("");
    setMinInput("");
    setMaxInput("");
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Leilões</h1>
          <p className="mt-1 text-muted">Dê lances ao vivo e confira o histórico de cada lote.</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Buscar lotes por título ou artista</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título ou artista"
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

      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted">Ordenar por</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Preço de (R$)</span>
          <input
            inputMode="decimal"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            placeholder="0,00"
            className={`${field} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">até (R$)</span>
          <input
            inputMode="decimal"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder="sem limite"
            className={`${field} w-28`}
          />
        </label>
        {filtered && (
          <button type="button" onClick={clearFilters} className="pb-2 text-muted underline underline-offset-4 hover:text-ink">
            Limpar filtros
          </button>
        )}
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
            {filtered ? "Nenhum lote com esses filtros." : current.empty}
          </p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {lots.map((lot) => (
                <LotCard key={lot.id} lot={lot} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setPaging({ key, pages: pages + 1 })}
                  className="rounded-full border border-line px-6 py-2 text-sm font-medium hover:border-brass"
                >
                  Carregar mais
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
