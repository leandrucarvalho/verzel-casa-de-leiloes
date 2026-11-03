"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { parseBRLToCents } from "@/lib/format";
import type { Lot, LotStatus } from "@/lib/types";
import { Icon } from "./Icon";
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
          <h1 className="text-4xl font-bold sm:text-5xl">Leilões de arte</h1>
          <p className="mt-2 max-w-xl text-muted">Obras reais do acervo do Cleveland Museum of Art. Lances ao vivo, saldo reservado na hora e histórico que qualquer pessoa pode auditar.</p>
        </div>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Buscar lotes por título ou artista</span>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título ou artista"
            className="field !pl-10"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Fase dos lotes" className="mt-8 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.id === "live" && <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-hidden />}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted">Ordenar por</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field !w-auto">
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Preço de (R$)</span>
          <input inputMode="decimal" value={minInput} onChange={(e) => setMinInput(e.target.value)} placeholder="0,00" className="field !w-32" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">até (R$)</span>
          <input inputMode="decimal" value={maxInput} onChange={(e) => setMaxInput(e.target.value)} placeholder="sem limite" className="field !w-32" />
        </label>
        {filtered && (
          <button type="button" onClick={clearFilters} className="btn btn-ghost btn-sm">
            <Icon name="x" size={16} /> Limpar filtros
          </button>
        )}
      </div>

      <div role="tabpanel" className="mt-6">
        {error && !lots ? (
          <div role="alert" className="card p-6">
            <p className="text-danger">{error}</p>
            <button onClick={() => setAttempt((n) => n + 1)} className="btn btn-ghost btn-sm mt-3">
              Tentar de novo
            </button>
          </div>
        ) : !lots ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-raised" />
            ))}
          </div>
        ) : lots.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-12 text-center text-muted">
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
                <button type="button" onClick={() => setPaging({ key, pages: pages + 1 })} className="btn btn-ghost">
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
