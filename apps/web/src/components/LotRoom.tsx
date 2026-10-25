"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { URGENT_MS, formatRemaining } from "@/lib/countdown";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useRoom } from "@/lib/useRoom";
import { BidPanel } from "./BidPanel";

const attributeLabels: Record<string, string> = { artist: "Artista", date: "Data", medium: "Técnica", origin: "Origem" };

export function LotRoom({ lotId }: { lotId: string }) {
  const { user } = useAuth();
  const { room, error, clockOffset, extended, gone, refresh, retry } = useRoom(lotId, user?.id);
  const now = useNow();

  const live = !gone && room?.lot.status === "live";
  const remaining = room && now ? new Date(room.lot.endsAt).getTime() - (now + clockOffset) : null;
  const overdue = live && remaining !== null && remaining <= 0;

  // the countdown reached zero: ask the server so the lot flips to "ended" without a reload
  useEffect(() => {
    if (overdue) refresh();
  }, [overdue, now, refresh]);

  if (error && !room) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-6">
        <p className="text-danger">{error}</p>
        <div className="mt-3 flex gap-4 text-sm">
          <button onClick={retry} className="underline underline-offset-4">
            Tentar de novo
          </button>
          <Link href="/" className="underline underline-offset-4">
            Voltar à vitrine
          </Link>
        </div>
      </div>
    );
  }
  if (!room) return <div className="aspect-[2/1] animate-pulse rounded-xl bg-line/60" aria-busy="true" />;

  const { lot, me } = room;
  const urgent = live && remaining !== null && remaining > 0 && remaining <= URGENT_MS;

  return (
    <article>
      <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
        ← Vitrine
      </Link>

      {gone && (
        <p role="alert" className="mt-4 rounded-xl border border-danger bg-danger/10 p-4 font-medium text-danger">
          Este lote foi cancelado pelo leiloeiro. Os lances não valem mais e, se você estava ganhando, o valor foi liberado.
        </p>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface">
          {lot.imageUrl && <Image src={lot.imageUrl} alt={lot.title} fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain p-4" />}
        </div>

        <div className="space-y-5">
          <header>
            <h1 className="text-3xl leading-tight font-semibold">{lot.title}</h1>
            <p className="mt-1 text-sm text-muted">Leiloeiro: {lot.auctioneer}</p>
          </header>

          <section className="rounded-xl border border-line bg-surface p-5" aria-live="polite">
            <p className="text-xs tracking-wide text-muted uppercase">
              {lot.status === "ended" && lot.result === "sold" ? "Arrematado por" : lot.currentBidCents ? "Lance atual" : "Lance inicial"}
            </p>
            <p className="text-4xl font-semibold">
              {formatBRL((lot.status === "ended" ? lot.winningBidCents : lot.currentBidCents) ?? lot.startingBidCents)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`} · incremento mínimo {formatBRL(lot.minIncrementCents)}
            </p>

            <div className="mt-4 border-t border-line pt-4">
              {live && remaining !== null && (
                <p className={`text-lg font-medium ${urgent ? "text-danger" : "text-live"}`}>
                  Termina em <span className="tabular-nums">{formatRemaining(remaining)}</span>
                </p>
              )}
              {lot.status === "scheduled" && <p className="text-lg">Começa em {formatDateTime(lot.startsAt)}</p>}
              {lot.status === "ended" && (
                <p className="text-lg">
                  {lot.result === "sold" ? "Lote encerrado e arrematado." : lot.result === "unsold" ? "Lote encerrado sem lances." : "Lote encerrado."}
                </p>
              )}
              {extended && (
                <p role="status" className="mt-1 text-sm font-medium text-danger">
                  Lance nos últimos minutos: o prazo foi estendido em 2 minutos.
                </p>
              )}
              <p className="mt-1 text-sm text-muted">Fim previsto: {formatDateTime(lot.endsAt)}</p>
            </div>
          </section>

          {me?.leading && live && (
            <p role="status" className="rounded-xl border border-live bg-live/10 p-4 font-medium text-live">
              Você está ganhando este lote com {formatBRL(me.myBidCents ?? 0)}.
            </p>
          )}
          {me?.outbid && live && (
            <p role="status" className="rounded-xl border border-danger bg-danger/10 p-4 font-medium text-danger">
              Você foi superado. Seu último lance foi {formatBRL(me.myBidCents ?? 0)}; o mínimo agora é {formatBRL(room.minimumNextBidCents)}.
            </p>
          )}
          {me?.leading && lot.status === "ended" && lot.result === "sold" && (
            <p className="rounded-xl border border-live bg-live/10 p-4 font-medium text-live">
              Parabéns, você arrematou este lote por {formatBRL(lot.winningBidCents ?? 0)}.{" "}
              <Link href="/arremates" className="underline underline-offset-4">
                Ver comprovante
              </Link>
            </p>
          )}

          {!gone && <BidPanel room={room} user={user} onPlaced={refresh} />}

          <p className="text-sm">
            <Link href={`/auditoria/${lot.id}`} className="text-muted underline underline-offset-4 hover:text-ink">
              Auditar o histórico de lances
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold">Histórico de lances</h2>
          {room.bids.length === 0 ? (
            <p className="mt-3 text-muted">Ainda não há lances. Seja o primeiro.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
              {room.bids.map((bid, i) => (
                <li key={bid.seq} className={`flex items-center justify-between gap-3 px-4 py-3 ${bid.mine ? "bg-brass/10" : ""}`}>
                  <div>
                    <p className="font-medium">
                      {bid.mine ? "Você" : bid.bidder}
                      {i === 0 && <span className="ml-2 rounded-full bg-live/15 px-2 py-0.5 text-xs text-live">lidera</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(bid.placedAt)}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatBRL(bid.amountCents)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold">Sobre a obra</h2>
          <dl className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {Object.entries(lot.attributes).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
                <dt className="text-muted">{attributeLabels[key] ?? key}</dt>
                <dd className="col-span-2">{value}</dd>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
              <dt className="text-muted">Início</dt>
              <dd className="col-span-2">{formatDateTime(lot.startsAt)}</dd>
            </div>
            <div className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
              <dt className="text-muted">Lance inicial</dt>
              <dd className="col-span-2">{formatBRL(lot.startingBidCents)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
