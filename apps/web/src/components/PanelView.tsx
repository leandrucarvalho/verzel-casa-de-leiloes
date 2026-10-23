"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Lot } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { LotCreator } from "./LotCreator";

const statusLabels: Record<Lot["status"], string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  ended: "Encerrado",
  cancelled: "Cancelado",
};

function result(l: Lot) {
  if (l.status !== "ended") return l.currentBidCents ? `Lance atual ${formatBRL(l.currentBidCents)}` : `Inicial ${formatBRL(l.startingBidCents)}`;
  return l.result === "sold" ? `Vendido por ${formatBRL(l.winningBidCents ?? 0)}` : "Sem lances";
}

export function PanelView() {
  const { data, error, reload } = useFetch<{ lots: Lot[]; totalReceivedCents: number }>("/lots/mine");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function cancel(id: string) {
    setCancelError(null);
    try {
      await api(`/lots/${id}/cancel`, { method: "POST" });
      setConfirming(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : "Não foi possível cancelar o lote.");
    }
  }

  if (error && !data) return <p role="alert" className="text-danger">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-line/60" aria-busy="true" />;

  return (
    <div className="space-y-8">
      <div className="max-w-sm rounded-xl border border-line bg-surface p-5">
        <p className="text-xs tracking-wide text-muted uppercase">Total recebido</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(data.totalReceivedCents)}</p>
        <p className="mt-1 text-xs text-muted">Soma dos lotes vendidos e já encerrados.</p>
      </div>

      <LotCreator onCreated={reload} />

      <section>
        <h2 className="text-xl font-semibold">Meus lotes</h2>
        {cancelError && <p role="alert" className="mt-2 text-sm text-danger">{cancelError}</p>}
        {data.lots.length === 0 ? (
          <p className="mt-3 text-muted">Você ainda não criou nenhum lote.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {data.lots.map((l) => {
              const cancellable = (l.status === "scheduled" || l.status === "live") && l.bidCount === 0;
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/lotes/${l.id}`} className="font-medium underline-offset-4 hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {statusLabels[l.status]} · {result(l)} · {l.bidCount === 1 ? "1 lance" : `${l.bidCount} lances`}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(l.startsAt)} → {formatDateTime(l.endsAt)}
                    </p>
                  </div>
                  {cancellable &&
                    (confirming === l.id ? (
                      <span className="flex items-center gap-3 text-sm">
                        <button type="button" onClick={() => cancel(l.id)} className="font-medium text-danger underline underline-offset-4">
                          Confirmar cancelamento
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="text-muted underline underline-offset-4">
                          Voltar
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirming(l.id)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                        Cancelar lote
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
