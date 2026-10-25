"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/auth";
import { formatBRL, parseBRLToCents } from "@/lib/format";
import { quickBids } from "@/lib/quickBids";
import type { Room } from "@/lib/types";

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
      <p className="rounded-xl border border-line bg-surface p-4 text-sm">
        <Link href="/login" className="font-medium underline underline-offset-4">
          Entre
        </Link>{" "}
        ou{" "}
        <Link href="/cadastro" className="font-medium underline underline-offset-4">
          crie uma conta
        </Link>{" "}
        para dar lances.
      </p>
    );
  }
  if (user.role === "auctioneer") {
    return <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">Leiloeiros não podem dar lances.</p>;
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
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-4" noValidate>
      <label htmlFor="bid" className="text-sm font-medium">
        Seu lance
      </label>
      <div className="mt-2 flex gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-line bg-paper px-3 focus-within:border-brass">
          <span className="text-muted">R$</span>
          <input
            id="bid"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={plain(minimumNextBidCents)}
            disabled={notStarted || busy}
            className="w-full bg-transparent px-2 py-2 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={notStarted || busy}
          className="rounded-full bg-brass px-5 py-2 font-medium text-brass-ink disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Dar lance"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Lances rápidos">
        <span className="text-sm text-muted">Lances rápidos:</span>
        {quickBids(minimumNextBidCents, lot.minIncrementCents).map((cents, i) => (
          <button
            key={cents}
            type="button"
            disabled={notStarted || busy}
            onClick={() => setAmount(plain(cents))}
            className="rounded-full border border-line px-3 py-1 text-sm hover:border-brass disabled:opacity-60"
          >
            {i === 0 ? `Mínimo ${formatBRL(cents)}` : formatBRL(cents)}
          </button>
        ))}
      </div>
      {notStarted && <p className="mt-2 text-sm text-muted">Este lote ainda não começou. Os lances abrem no horário de início.</p>}
      {feedback && (
        <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${feedback.kind === "error" ? "text-danger" : "text-live"}`}>
          {feedback.text}
        </p>
      )}
    </form>
  );
}
