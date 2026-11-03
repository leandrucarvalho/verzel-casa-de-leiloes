"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatBRL, formatDateTime } from "@/lib/format";
import { visualOf, visuals } from "@/lib/lotState";
import type { Lot } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { useNow } from "@/lib/useNow";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { LotCreator } from "./LotCreator";
import { StatusBadge } from "./StatusBadge";

function result(l: Lot) {
  if (l.status === "cancelled") return "Cancelado, sem efeito financeiro";
  if (l.status !== "ended") return l.currentBidCents ? `Lance atual ${formatBRL(l.currentBidCents)}` : `Inicial ${formatBRL(l.startingBidCents)}`;
  return l.result === "sold" ? `Vendido por ${formatBRL(l.winningBidCents ?? 0)}` : "Sem lances";
}

export function PanelView() {
  const { data, error, reload } = useFetch<{ lots: Lot[]; totalReceivedCents: number }>("/lots/mine");
  const now = useNow();
  const [target, setTarget] = useState<Lot | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function cancel() {
    if (!target) return;
    setBusy(true);
    setCancelError(null);
    try {
      await api(`/lots/${target.id}/cancel`, { method: "POST" });
      setTarget(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : "Não foi possível cancelar o lote.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setTarget(null);
    setCancelError(null);
  }

  if (error && !data) return <p role="alert" className="text-danger">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;

  const open = data.lots.filter((l) => l.status === "live" || l.status === "scheduled").length;

  return (
    <div className="space-y-10">
      <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2">
        <div className="card relative overflow-hidden border-sold/40 p-6">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-sold" aria-hidden />
          <p className="eyebrow flex items-center gap-2 !text-sold">
            <Icon name="wallet" size={16} /> Total recebido
          </p>
          <p className="num font-display mt-2 text-4xl font-bold">{formatBRL(data.totalReceivedCents)}</p>
          <p className="mt-1 text-sm text-muted">Soma dos lotes vendidos e já encerrados.</p>
        </div>
        <div className="card p-6">
          <p className="eyebrow flex items-center gap-2">
            <Icon name="gavel" size={16} /> Lotes em andamento
          </p>
          <p className="num font-display mt-2 text-4xl font-bold">{open}</p>
          <p className="mt-1 text-sm text-muted">Ao vivo ou agendados, ainda dentro do prazo.</p>
        </div>
      </section>

      <LotCreator onCreated={reload} />

      <section>
        <h2 className="text-xl font-bold">Meus lotes</h2>
        {data.lots.length === 0 ? (
          <p className="mt-3 text-muted">Você ainda não criou nenhum lote.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.lots.map((l) => {
              const cancellable = l.status === "scheduled" || l.status === "live";
              const meta = visuals[visualOf(l, now)];
              const cancelled = l.status === "cancelled";
              return (
                <li key={l.id} className={`card relative flex flex-wrap items-center justify-between gap-4 overflow-hidden py-4 pr-4 pl-6`}>
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${meta.bar}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge lot={l} now={now} />
                      <Link href={`/lotes/${l.id}`} className={`link font-semibold ${cancelled ? "line-through decoration-danger/60" : ""}`}>
                        {l.title}
                      </Link>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      <span className="num font-semibold text-ink">{result(l)}</span> · {l.bidCount === 1 ? "1 lance" : `${l.bidCount} lances`}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(l.startsAt)} → {formatDateTime(l.endsAt)}
                    </p>
                  </div>
                  {cancellable && (
                    <button type="button" onClick={() => setTarget(l)} className="btn btn-danger-ghost btn-sm" aria-label={`Cancelar o lote ${l.title}`}>
                      <Icon name="ban" size={16} /> Cancelar lote
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={target !== null}
        title="Cancelar este lote?"
        confirmLabel="Sim, cancelar o lote"
        keepLabel="Manter o lote"
        busy={busy}
        error={cancelError}
        onConfirm={cancel}
        onClose={close}
      >
        <p>
          <span className="font-semibold text-ink">{target?.title}</span> sairá da vitrine e ninguém mais poderá dar lances. Isso não pode ser desfeito.
        </p>
        {target && target.bidCount > 0 && (
          <p className="mt-2">
            O valor comprometido pelo líder ({formatBRL(target.currentBidCents ?? 0)}) será liberado e registrado como estorno na carteira dele.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
