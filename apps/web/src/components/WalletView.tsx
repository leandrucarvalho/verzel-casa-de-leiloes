"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, formatDateTime, parseBRLToCents } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";

interface Wallet {
  totalCents: number;
  committedCents: number;
  availableCents: number;
  entries: { id: number; kind: string; amountCents: number; lotId: string | null; createdAt: string }[];
}

const kindLabels: Record<string, string> = {
  deposit: "Depósito",
  settlement_debit: "Arremate pago",
  settlement_credit: "Venda recebida",
  refund: "Estorno (lote cancelado)",
};

function Figure({ label, cents, hint }: { label: string; cents: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(cents)}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

export function WalletView() {
  const { data: wallet, error, reload } = useFetch<Wallet>("/wallet");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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

  if (error && !wallet) return <p role="alert" className="text-danger">{error}</p>;
  if (!wallet) return <div className="h-40 animate-pulse rounded-xl bg-line/60" aria-busy="true" />;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Saldo total" cents={wallet.totalCents} hint="Tudo que você depositou, menos o que já pagou." />
        <Figure label="Comprometido" cents={wallet.committedCents} hint="Reservado nos lotes em que você está ganhando." />
        <Figure label="Disponível" cents={wallet.availableCents} hint="O que ainda pode usar em novos lances." />
      </div>

      <form onSubmit={submit} className="max-w-md rounded-xl border border-line bg-surface p-5" noValidate>
        <label htmlFor="deposit" className="text-sm font-medium">
          Depositar (simulado)
        </label>
        <div className="mt-2 flex gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-line bg-paper px-3 focus-within:border-brass">
            <span className="text-muted">R$</span>
            <input
              id="deposit"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500,00"
              disabled={busy}
              className="w-full bg-transparent px-2 py-2 outline-none"
            />
          </div>
          <button type="submit" disabled={busy} className="rounded-full bg-brass px-5 py-2 font-medium text-brass-ink disabled:opacity-60">
            {busy ? "Enviando…" : "Depositar"}
          </button>
        </div>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`mt-3 text-sm ${feedback.ok ? "text-live" : "text-danger"}`}>
            {feedback.text}
          </p>
        )}
      </form>

      <section>
        <h2 className="text-xl font-semibold">Extrato</h2>
        {wallet.entries.length === 0 ? (
          <p className="mt-3 text-muted">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {wallet.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {e.lotId ? (
                      <Link href={`/lotes/${e.lotId}`} className="underline underline-offset-4">
                        {kindLabels[e.kind] ?? e.kind}
                      </Link>
                    ) : (
                      (kindLabels[e.kind] ?? e.kind)
                    )}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                </div>
                {e.kind === "refund" ? (
                  <p className="text-right text-sm">
                    <span className="font-semibold tabular-nums">{formatBRL(e.amountCents)}</span>
                    <span className="block text-xs text-muted">liberado do comprometido</span>
                  </p>
                ) : (
                  <p className={`font-semibold tabular-nums ${e.kind === "settlement_debit" ? "text-danger" : "text-live"}`}>
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
