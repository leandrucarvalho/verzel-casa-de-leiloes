"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { formatRemaining } from "@/lib/countdown";
import { formatBRL, formatDateTime } from "@/lib/format";
import { visualOf, visuals } from "@/lib/lotState";
import { useNow } from "@/lib/useNow";
import { useRoom } from "@/lib/useRoom";
import { BidPanel } from "./BidPanel";
import { Icon, type IconName } from "./Icon";
import { StatusBadge } from "./StatusBadge";

const HISTORY_STEP = 10;

const attributeLabels: Record<string, string> = { artist: "Artista", date: "Data", medium: "Técnica", origin: "Origem" };

function Banner({ tone, icon, children, alert = false }: { tone: "live" | "danger" | "sold"; icon: IconName; children: ReactNode; alert?: boolean }) {
  const tones = {
    live: "border-live/50 bg-live/10 text-live",
    danger: "border-danger/50 bg-danger/10 text-danger",
    sold: "border-sold/50 bg-sold/10 text-sold",
  };
  return (
    <p role={alert ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border p-4 font-semibold ${tones[tone]}`}>
      <Icon name={icon} size={22} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function LotRoom({ lotId }: { lotId: string }) {
  const { user } = useAuth();
  const { room, error, clockOffset, extended, gone, refresh, retry } = useRoom(lotId, user?.id);
  const now = useNow();
  const [shown, setShown] = useState(HISTORY_STEP);

  const live = !gone && room?.lot.status === "live";
  const serverNow = now ? now + clockOffset : 0;
  const remaining = room && now ? new Date(room.lot.endsAt).getTime() - serverNow : null;
  const overdue = live && remaining !== null && remaining <= 0;

  // the countdown reached zero: ask the server so the lot flips to "ended" without a reload
  useEffect(() => {
    if (overdue) refresh();
  }, [overdue, now, refresh]);

  if (error && !room) {
    return (
      <div role="alert" className="card p-6">
        <p className="text-danger">{error}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={retry} className="btn btn-ghost btn-sm">
            Tentar de novo
          </button>
          <Link href="/" className="btn btn-ghost btn-sm">
            Voltar à vitrine
          </Link>
        </div>
      </div>
    );
  }
  if (!room) return <div className="aspect-[2/1] animate-pulse rounded-2xl bg-raised" aria-busy="true" />;

  const { lot, me } = room;
  const visual = visualOf(lot, serverNow);
  const meta = visuals[visual];
  const sold = lot.status === "ended" && lot.result === "sold";

  return (
    <article>
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} /> Vitrine
      </Link>

      {gone && (
        <div className="mt-2">
          <Banner tone="danger" icon="ban" alert>
            Este lote foi cancelado pelo leiloeiro. Os lances não valem mais e, se você estava ganhando, o valor foi liberado.
          </Banner>
        </div>
      )}

      <div className="mt-2 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-line bg-mat">
          {lot.imageUrl && (
            <Image src={lot.imageUrl} alt={lot.title} fill unoptimized sizes="(min-width: 1024px) 55vw, 100vw" className="object-contain p-6 sm:p-10" />
          )}
          <StatusBadge lot={lot} now={serverNow} className="absolute top-4 left-4 bg-bg/80 backdrop-blur" />
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <header>
            <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{lot.title}</h1>
            {lot.attributes.artist && <p className="mt-1 text-lg text-muted">{lot.attributes.artist}</p>}
            <p className="mt-1 text-sm text-muted">Leiloeiro: {lot.auctioneer}</p>
          </header>

          {/* One atomic announcement when the price changes; the ticking countdown is deliberately not live. */}
          <p role="status" aria-atomic="true" className="sr-only">
            {lot.currentBidCents ? `Lance atual ${formatBRL(lot.currentBidCents)}` : "Nenhum lance ainda"}, {lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`}.
          </p>
          <section className="card p-5">
            <p className="eyebrow">{sold ? "Arrematado por" : lot.currentBidCents ? "Lance atual" : "Lance inicial"}</p>
            <p className="num font-display text-5xl font-bold">
              {formatBRL((lot.status === "ended" ? lot.winningBidCents : lot.currentBidCents) ?? lot.startingBidCents)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`} · incremento mínimo {formatBRL(lot.minIncrementCents)}
            </p>

            <div className="mt-4 border-t border-line pt-4">
              {live && remaining !== null && (
                <div className={`flex items-center gap-3 ${meta.text}`}>
                  <Icon name="clock" size={28} />
                  <div>
                    <p className="eyebrow !text-current">Termina em</p>
                    <p className="num font-display text-3xl leading-none font-bold">{formatRemaining(remaining)}</p>
                  </div>
                </div>
              )}
              {lot.status === "scheduled" && (
                <p className="flex items-center gap-2 text-lg font-semibold text-scheduled">
                  <Icon name="calendar" /> Começa em {formatDateTime(lot.startsAt)}
                </p>
              )}
              {lot.status === "ended" && (
                <p className={`flex items-center gap-2 text-lg font-semibold ${meta.text}`}>
                  <Icon name={meta.icon} />
                  {sold ? "Lote encerrado e arrematado." : lot.result === "unsold" ? "Lote encerrado sem lances." : "Lote encerrado."}
                </p>
              )}
              {extended && (
                <p role="status" className="mt-2 text-sm font-semibold text-urgent">
                  Lance nos últimos minutos: o prazo foi estendido em 2 minutos.
                </p>
              )}
              <p className="mt-2 text-sm text-muted">Fim previsto: {formatDateTime(lot.endsAt)}</p>
            </div>
          </section>

          {me?.leading && live && (
            <Banner tone="live" icon="trend">
              Você está ganhando este lote com {formatBRL(me.myBidCents ?? 0)}.
            </Banner>
          )}
          {me?.outbid && live && (
            <Banner tone="danger" icon="alert">
              Você foi superado. Seu último lance foi {formatBRL(me.myBidCents ?? 0)}; o mínimo agora é {formatBRL(room.minimumNextBidCents)}.
            </Banner>
          )}
          {me?.leading && sold && (
            <Banner tone="sold" icon="trophy">
              Parabéns, você arrematou este lote por {formatBRL(lot.winningBidCents ?? 0)}.{" "}
              <Link href="/arremates" className="link">
                Ver comprovante
              </Link>
            </Banner>
          )}

          {!gone && <BidPanel room={room} user={user} onPlaced={refresh} />}

          <Link href={`/auditoria/${lot.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
            <Icon name="shield" size={18} />
            <span className="link">Auditar o histórico de lances</span>
          </Link>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Histórico de lances</h2>
          {room.bids.length === 0 ? (
            <p className="mt-3 text-muted">Ainda não há lances. Seja o primeiro.</p>
          ) : (
            <>
              <ol className="card mt-3 divide-y divide-line overflow-hidden">
                {room.bids.slice(0, shown).map((bid, i) => (
                  <li key={bid.seq} className={`flex items-center justify-between gap-3 px-4 py-3 ${bid.mine ? "bg-brand/10" : ""}`}>
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        {bid.mine ? "Você" : bid.bidder}
                        {i === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-xs font-semibold text-live">
                            <Icon name="trend" size={12} /> lidera
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(bid.placedAt)}</p>
                    </div>
                    <p className={`num font-display text-lg font-bold ${i === 0 ? "text-live" : ""}`}>{formatBRL(bid.amountCents)}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                {shown < room.bids.length && (
                  <button type="button" onClick={() => setShown((n) => n + HISTORY_STEP)} className="btn btn-ghost btn-sm">
                    Mostrar mais {Math.min(HISTORY_STEP, room.bids.length - shown)}
                  </button>
                )}
                {lot.bidCount > room.bids.length && shown >= room.bids.length && (
                  <span>
                    Mostrando os {room.bids.length} lances mais recentes de {lot.bidCount}.{" "}
                    <Link href={`/auditoria/${lot.id}`} className="link">
                      Histórico completo na auditoria
                    </Link>
                  </span>
                )}
              </p>
            </>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold">Sobre a obra</h2>
          <dl className="card mt-3 divide-y divide-line overflow-hidden">
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
              <dd className="num col-span-2">{formatBRL(lot.startingBidCents)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
