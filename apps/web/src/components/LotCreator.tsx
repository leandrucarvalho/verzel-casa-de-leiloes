"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, parseBRLToCents } from "@/lib/format";

interface CatalogItem {
  externalId: string;
  title: string;
  imageUrl: string;
  attributes: Record<string, string>;
}

const field = "w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-brass";

// value for <input type="datetime-local"> in the browser's timezone
const localValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function LotCreator({ onCreated }: { onCreated: () => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMessage(null);
    try {
      setItems((await api<{ items: CatalogItem[] }>(`/catalog/search?${new URLSearchParams({ q: query.trim() })}`)).items);
    } catch (err) {
      setItems(null);
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Não foi possível buscar no catálogo." });
    } finally {
      setSearching(false);
    }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) return;
    const form = new FormData(e.currentTarget);
    const startingBidCents = parseBRLToCents(String(form.get("starting")));
    const minIncrementCents = parseBRLToCents(String(form.get("increment")));
    const startsAt = new Date(String(form.get("startsAt")));
    const endsAt = new Date(String(form.get("endsAt")));
    if (!startingBidCents || !minIncrementCents) {
      setMessage({ ok: false, text: "Informe o lance inicial e o incremento mínimo, por exemplo 1.000,00." });
      return;
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setMessage({ ok: false, text: "Informe o início e o fim do leilão." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api("/lots", {
        body: {
          externalId: picked.externalId,
          title: picked.title,
          imageUrl: picked.imageUrl,
          attributes: picked.attributes,
          startingBidCents,
          minIncrementCents,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      });
      setMessage({ ok: true, text: `Lote "${picked.title}" criado com lance inicial de ${formatBRL(startingBidCents)}.` });
      setPicked(null);
      onCreated();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Não foi possível criar o lote." });
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Novo lote</h2>
      <p className="mt-1 text-sm text-muted">Busque uma obra no acervo do Cleveland Museum of Art e defina as regras do leilão.</p>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: monet, hokusai, bronze"
          aria-label="Buscar no catálogo"
          className={field}
        />
        <button type="submit" disabled={searching} className="rounded-full bg-brass px-5 py-2 font-medium text-brass-ink disabled:opacity-60">
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {items && items.length === 0 && <p className="mt-4 text-muted">Nenhuma obra encontrada.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.externalId}>
              <button
                type="button"
                onClick={() => setPicked(it)}
                aria-pressed={picked?.externalId === it.externalId}
                className={`w-full rounded-lg border p-2 text-left text-sm hover:border-brass ${picked?.externalId === it.externalId ? "border-brass bg-brass/10" : "border-line"}`}
              >
                <span className="relative block aspect-[4/5] overflow-hidden rounded bg-paper">
                  <Image src={it.imageUrl} alt="" fill unoptimized sizes="200px" className="object-contain" />
                </span>
                <span className="mt-2 line-clamp-2 block font-medium">{it.title}</span>
                <span className="block truncate text-xs text-muted">{it.attributes.artist ?? "Artista desconhecido"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <form onSubmit={create} className="mt-6 space-y-4 border-t border-line pt-5" noValidate>
          <p className="font-medium">Lote: {picked.title}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Lance inicial (R$)
              <input name="starting" inputMode="decimal" placeholder="1.000,00" className={field} />
            </label>
            <label className="block text-sm">
              Incremento mínimo (R$)
              <input name="increment" inputMode="decimal" placeholder="50,00" className={field} />
            </label>
            <label className="block text-sm">
              Início
              <input name="startsAt" type="datetime-local" defaultValue={localValue(now)} className={field} />
            </label>
            <label className="block text-sm">
              Fim
              <input name="endsAt" type="datetime-local" defaultValue={localValue(new Date(now.getTime() + 24 * 3_600_000))} className={field} />
            </label>
          </div>
          <button type="submit" disabled={busy} className="rounded-full bg-brass px-5 py-2 font-medium text-brass-ink disabled:opacity-60">
            {busy ? "Criando…" : "Criar lote"}
          </button>
        </form>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-4 text-sm ${message.ok ? "text-live" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
