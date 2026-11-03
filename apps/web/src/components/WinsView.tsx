"use client";

import Image from "next/image";
import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Lot } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { CopyLink } from "./CopyLink";
import { Icon, type IconName } from "./Icon";

type Participation = Lot & { myBidCents: number; leading: boolean; receiptToken: string | null };

function standing(l: Participation): { text: string; tone: string; icon: IconName } {
  if (l.status === "cancelled") return { text: "Lote cancelado pelo leiloeiro. Se você liderava, o valor foi liberado.", tone: "text-danger", icon: "ban" };
  if (l.status === "ended") {
    if (l.receiptToken) return { text: `Arrematado por ${formatBRL(l.winningBidCents ?? 0)}`, tone: "text-sold", icon: "trophy" };
    return { text: "Não arrematado", tone: "text-ended", icon: "flag" };
  }
  if (l.status === "live") {
    return l.leading ? { text: "Você está ganhando", tone: "text-live", icon: "trend" } : { text: "Você foi superado", tone: "text-danger", icon: "alert" };
  }
  return { text: "Aguardando", tone: "text-scheduled", icon: "calendar" };
}

export function WinsView() {
  const { data: lots, error } = useFetch<Participation[]>("/lots/participating");

  if (error && !lots) return <p role="alert" className="text-danger">{error}</p>;
  if (!lots) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;
  if (lots.length === 0) {
    return (
      <p className="card p-6 text-muted">
        Você ainda não deu nenhum lance.{" "}
        <Link href="/" className="link font-semibold text-ink">
          Ver a vitrine
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {lots.map((l) => {
        const s = standing(l);
        return (
          <li key={l.id} className="card flex gap-4 p-4">
            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-mat">
              {l.imageUrl && <Image src={l.imageUrl} alt="" fill unoptimized sizes="96px" className="object-contain p-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/lotes/${l.id}`} className="link font-semibold">
                {l.title}
              </Link>
              <p className={`mt-1 flex items-center gap-2 text-sm font-semibold ${s.tone}`}>
                <Icon name={s.icon} size={16} className="shrink-0" />
                {s.text}
              </p>
              <p className="text-sm text-muted">
                Seu lance: <span className="num">{formatBRL(l.myBidCents)}</span>
                {l.status !== "cancelled" && ` · ${l.status === "ended" ? "encerrado" : "termina"} em ${formatDateTime(l.endsAt)}`}
              </p>
              {l.receiptToken && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/comprovante/${l.receiptToken}`} className="btn btn-brand btn-sm">
                    Ver comprovante
                  </Link>
                  <CopyLink path={`/comprovante/${l.receiptToken}`} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
