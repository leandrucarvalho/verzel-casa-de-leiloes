"use client";

import Image from "next/image";
import Link from "next/link";
import { formatRemaining } from "@/lib/countdown";
import { formatBRL, formatDateTime } from "@/lib/format";
import { visualOf, visuals } from "@/lib/lotState";
import type { Lot } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

export function LotCard({ lot }: { lot: Lot }) {
  const now = useNow();
  const artist = lot.attributes.artist;
  const visual = visualOf(lot, now);
  const meta = visuals[visual];
  const live = lot.status === "live";
  const left = live && now ? new Date(lot.endsAt).getTime() - now : null;
  const sold = lot.status === "ended" && lot.result === "sold";
  const shown = sold ? lot.winningBidCents : lot.currentBidCents;
  const label = sold ? "Arrematado por" : lot.currentBidCents ? "Lance atual" : "Lance inicial";

  return (
    <Link
      href={`/lotes/${lot.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-card"
    >
      <div className="relative aspect-[4/5] bg-mat">
        {lot.imageUrl && (
          <Image
            src={lot.imageUrl}
            alt={lot.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
            className={`object-contain p-5 transition duration-300 group-hover:scale-[1.03] ${lot.status === "ended" && !sold ? "opacity-70 grayscale" : ""}`}
          />
        )}
        <StatusBadge lot={lot} now={now} className="absolute top-3 left-3 bg-bg/80 backdrop-blur" />
        {left !== null && (
          <span
            className={`num absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border bg-bg/80 px-2.5 py-1 text-xs font-semibold backdrop-blur ${meta.text} ${meta.border}`}
          >
            <Icon name="clock" size={14} />
            {formatRemaining(left)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold">{lot.title}</h3>
        {artist && <p className="line-clamp-1 text-sm text-muted">{artist}</p>}

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <p className="eyebrow">{label}</p>
            <p className="num font-display text-2xl font-bold">{formatBRL(shown ?? lot.startingBidCents)}</p>
          </div>
          <p className="flex items-center gap-1.5 pb-1 text-sm text-muted">
            <Icon name="gavel" size={15} />
            <span className="num">{lot.bidCount}</span>
            <span className="sr-only">{lot.bidCount === 1 ? "lance" : "lances"}</span>
          </p>
        </div>
        {lot.status === "scheduled" && <p className="text-sm text-scheduled">Começa em {formatDateTime(lot.startsAt)}</p>}
      </div>
    </Link>
  );
}
