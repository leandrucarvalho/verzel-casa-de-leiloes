"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/auth";
import { formatBRL, parseBRLToCents } from "@/lib/format";
import { quickBids } from "@/lib/quickBids";
import type { Room } from "@/lib/types";
import { Icon } from "./Icon";

type Feedback = { kind: "ok" | "error"; text: string } | null;

const plain = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function BidPanel({ room, user, onPlaced }: { room: Room; user: User | null; onPlaced: () => void }) {
  const { lot, minimumNextBidCents } = room;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (lot.status === "ended" || lot.status === "cancelled") return null;

  if (!user) {
    return (
      <div className="card p-5">
        <p className="font-semibold">Quer dar um lance?</p>
        <p className="mt-1 text-sm text-muted">Crie uma conta de licitante, deposite um saldo simulado e participe ao vivo.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/cadastro" className="btn btn-brand">
            Criar conta
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Entrar
          </Link>
        </div>
      </div>
    );
  }
  if (user.role === "auctioneer") {
    return <p className="card p-5 text-sm text-muted">Leiloeiros não podem dar lances.</p>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseBRLToCents(amount);
    if (!cents) {
      setFeedback({ kind: "error", text: "Informe um valor válido, por exemplo 1.050,00." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const placed = await api<{ amountCents: number; extended: boolean }>(`/lots/${lot.id}/bids`, {
        body: { amountCents: cents },
      });
      setFeedback({
        kind: "ok",
        text: `Lance de ${formatBRL(placed.amountCents)} registrado.${placed.extended ? " O prazo do lote foi estendido em 2 minutos." : ""}`,
      });
      setAmount("");
      onPlaced();
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível enviar o lance." });
      onPlaced();
    } finally {
      setBusy(false);
    }
  }

  const notStarted = lot.status === "scheduled";

  return (
    <form onSubmit={submit} className="card p-5" noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="bid" className="font-semibold">
          Seu lance
        </label>
        <span className="text-sm text-muted">
          Mínimo <span className="num font-semibold text-ink">{formatBRL(minimumNextBidCents)}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="field flex flex-1 items-center gap-1 !py-0 focus-within:border-brand focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_30%,transparent)]">
          <span className="text-muted">R$</span>
          <input
            id="bid"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={plain(minimumNextBidCents)}
            disabled={notStarted || busy}
            aria-describedby={feedback ? "bid-feedback" : undefined}
            className="num w-full bg-transparent py-2 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted"
          />
        </div>
        <button type="submit" disabled={notStarted || busy} className="btn btn-bid px-7 text-base">
          <Icon name="gavel" size={18} />
          {busy ? "Enviando…" : "Dar lance"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Lances rápidos">
        <span className="text-sm text-muted">Lances rápidos</span>
        {quickBids(minimumNextBidCents, lot.minIncrementCents).map((cents, i) => (
          <button key={cents} type="button" disabled={notStarted || busy} onClick={() => setAmount(plain(cents))} className="chip num">
            {i === 0 ? `Mínimo ${formatBRL(cents)}` : formatBRL(cents)}
          </button>
        ))}
      </div>

      {notStarted && <p className="mt-3 text-sm text-scheduled">Este lote ainda não começou. Os lances abrem no horário de início.</p>}
      {feedback && (
        <p
          id="bid-feedback"
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-2 text-sm font-medium ${feedback.kind === "error" ? "text-danger" : "text-live"}`}
        >
          <Icon name={feedback.kind === "error" ? "alert" : "check"} size={18} className="mt-0.5 shrink-0" />
          {feedback.text}
        </p>
      )}
    </form>
  );
}
