"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, formatDateTime, parseBRLToCents } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";
import { Icon } from "./Icon";

interface Wallet {
  totalCents: number;
  committedCents: number;
  availableCents: number;
  entries: { id: number; kind: string; amountCents: number; lotId: string | null; lotTitle: string | null; createdAt: string }[];
}

const kindLabels: Record<string, string> = {
  deposit: "Depósito",
  settlement_debit: "Arremate pago",
  settlement_credit: "Venda recebida",
  refund: "Estorno (lote cancelado)",
};

const filters: { id: string; label: string; kinds: string[] | null }[] = [
  { id: "all", label: "Todos", kinds: null },
  { id: "deposit", label: "Depósitos", kinds: ["deposit"] },
  { id: "win", label: "Arremates", kinds: ["settlement_debit"] },
  { id: "refund", label: "Estornos", kinds: ["refund"] },
];

export function WalletView() {
  const { data: wallet, error, reload } = useFetch<Wallet>("/wallet");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState("all");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseBRLToCents(amount);
    if (!cents) {
      setFeedback({ ok: false, text: "Informe um valor válido, por exemplo 500,00." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await api("/wallet/deposit", { body: { amountCents: cents } });
      setFeedback({ ok: true, text: `Depósito de ${formatBRL(cents)} realizado.` });
      setAmount("");
      reload();
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof ApiError ? err.message : "Não foi possível depositar." });
    } finally {
      setBusy(false);
    }
  }

  const kinds = filters.find((f) => f.id === filter)?.kinds;
  const entries = wallet ? wallet.entries.filter((e) => !kinds || kinds.includes(e.kind)) : [];

  if (error && !wallet) return <p role="alert" className="text-danger">{error}</p>;
  if (!wallet) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;

  return (
    <div className="space-y-10">
      <section aria-label="Resumo do saldo" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* The number that decides whether a bid can be placed gets the room. */}
        <div className="card relative overflow-hidden border-bid/40 p-6">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-bid" aria-hidden />
          <p className="eyebrow flex items-center gap-2 !text-bid">
            <Icon name="wallet" size={16} /> Disponível para lances
          </p>
          <p className="num font-display mt-2 text-5xl font-bold sm:text-6xl">{formatBRL(wallet.availableCents)}</p>
          <p className="mt-2 text-sm text-muted">É o limite do seu próximo lance: saldo total menos o que está reservado.</p>
        </div>

        <dl className="card divide-y divide-line">
          <div className="flex items-baseline justify-between gap-4 p-5">
            <div>
              <dt className="text-sm font-medium">Saldo total</dt>
              <dd className="text-xs text-muted">Depositado, menos o que já pagou.</dd>
            </div>
            <dd className="num font-display text-xl font-semibold">{formatBRL(wallet.totalCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 p-5">
            <div>
              <dt className="text-sm font-medium">Comprometido</dt>
              <dd className="text-xs text-muted">Reservado nos lotes em que você lidera.</dd>
            </div>
            <dd className="num font-display text-xl font-semibold text-urgent">− {formatBRL(wallet.committedCents)}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={submit} className="card max-w-lg p-5" noValidate>
        <label htmlFor="deposit" className="font-semibold">
          Depositar (simulado)
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="field flex flex-1 items-center gap-1 !py-0 focus-within:border-brand focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_30%,transparent)]">
            <span className="text-muted">R$</span>
            <input
              id="deposit"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500,00"
              disabled={busy}
              className="num w-full bg-transparent py-2 outline-none placeholder:text-muted"
            />
          </div>
          <button type="submit" disabled={busy} className="btn btn-brand">
            {busy ? "Enviando…" : "Depositar"}
          </button>
        </div>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`mt-3 flex items-center gap-2 text-sm font-medium ${feedback.ok ? "text-live" : "text-danger"}`}>
            <Icon name={feedback.ok ? "check" : "alert"} size={16} />
            {feedback.text}
          </p>
        )}
      </form>

      <section>
        <h2 className="text-xl font-bold">Extrato</h2>
        <p className="mt-1 text-sm text-muted">Mostrando as últimas movimentações (no máximo 50).</p>
        <div role="group" aria-label="Filtrar extrato" className="mt-3 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className="chip">
              {f.label}
            </button>
          ))}
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-muted">{wallet.entries.length === 0 ? "Nenhuma movimentação ainda." : "Nenhuma movimentação desse tipo."}</p>
        ) : (
          <ul className="card mt-3 divide-y divide-line overflow-hidden">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{kindLabels[e.kind] ?? e.kind}</p>
                  {e.lotId && (
                    <Link href={`/lotes/${e.lotId}`} className="link block truncate text-sm">
                      {e.lotTitle ?? "Ver lote"}
                    </Link>
                  )}
                  <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                </div>
                {e.kind === "refund" ? (
                  <p className="text-right text-sm">
                    <span className="num font-semibold">{formatBRL(e.amountCents)}</span>
                    <span className="block text-xs text-muted">liberado do comprometido</span>
                  </p>
                ) : (
                  <p className={`num font-display text-lg font-bold ${e.kind === "settlement_debit" ? "text-danger" : "text-live"}`}>
                    {e.kind === "settlement_debit" ? "−" : "+"} {formatBRL(e.amountCents)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
