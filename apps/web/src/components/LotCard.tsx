"use client";

import Image from "next/image";
import Link from "next/link";
import { URGENT_MS, formatRemaining } from "@/lib/countdown";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Lot } from "@/lib/types";
import { useNow } from "@/lib/useNow";

function Status({ lot, now }: { lot: Lot; now: number }) {
  if (!now) return <span className="text-muted">&nbsp;</span>;
  if (lot.status === "live") {
    const left = new Date(lot.endsAt).getTime() - now;
    return (
      <span className={`flex items-center gap-2 text-sm font-medium ${left <= URGENT_MS ? "text-danger" : "text-live"}`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden />
        Ao vivo · termina em {formatRemaining(left)}
      </span>
    );
  }
  if (lot.status === "scheduled") {
    return <span className="text-sm text-muted">Começa em {formatDateTime(lot.startsAt)}</span>;
  }
  return (
    <span className="text-sm text-muted">
      {lot.result === "sold" ? "Arrematado" : lot.result === "unsold" ? "Encerrado sem lances" : "Encerrado"}
    </span>
  );
}

export function LotCard({ lot }: { lot: Lot }) {
  const now = useNow();
  const artist = lot.attributes.artist;
  const shown = lot.status === "ended" && lot.result === "sold" ? lot.winningBidCents : lot.currentBidCents;
  const label =
    lot.status === "ended" ? (lot.result === "sold" ? "Arrematado por" : "Lance inicial") : lot.currentBidCents ? "Lance atual" : "Lance inicial";

  return (
    <Link
      href={`/lotes/${lot.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-brass"
    >
      <div className="relative aspect-[4/5] bg-paper">
        {lot.imageUrl && (
          <Image
            src={lot.imageUrl}
            alt={lot.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
            className="object-contain p-3 transition group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold">{lot.title}</h3>
        {artist && <p className="line-clamp-1 text-sm text-muted">{artist}</p>}
        <div className="mt-auto pt-2">
          <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
          <p className="text-xl font-semibold">{formatBRL(shown ?? lot.startingBidCents)}</p>
          <p className="text-xs text-muted">{lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`}</p>
        </div>
        <Status lot={lot} now={now} />
      </div>
    </Link>
  );
}
