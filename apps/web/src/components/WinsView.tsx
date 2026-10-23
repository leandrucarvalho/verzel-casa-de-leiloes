"use client";

import Image from "next/image";
import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Lot } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";
import { CopyLink } from "./CopyLink";

type Participation = Lot & { myBidCents: number; leading: boolean; receiptToken: string | null };

function standing(l: Participation) {
  if (l.status === "cancelled") return { text: "Lote cancelado pelo leiloeiro. Se você liderava, o valor foi liberado.", tone: "text-muted" };
  if (l.status === "ended") {
    if (l.receiptToken) return { text: `Arrematado por ${formatBRL(l.winningBidCents ?? 0)}`, tone: "text-live" };
    return { text: "Não arrematado", tone: "text-muted" };
  }
  if (l.status === "live") return l.leading ? { text: "Você está ganhando", tone: "text-live" } : { text: "Você foi superado", tone: "text-danger" };
  return { text: "Aguardando", tone: "text-muted" };
}

export function WinsView() {
  const { data: lots, error } = useFetch<Participation[]>("/lots/participating");

  if (error && !lots) return <p role="alert" className="text-danger">{error}</p>;
  if (!lots) return <div className="h-40 animate-pulse rounded-xl bg-line/60" aria-busy="true" />;
  if (lots.length === 0) {
    return (
      <p className="text-muted">
        Você ainda não deu nenhum lance.{" "}
        <Link href="/" className="underline underline-offset-4">
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
          <li key={l.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4">
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-paper">
              {l.imageUrl && <Image src={l.imageUrl} alt="" fill unoptimized sizes="80px" className="object-contain" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/lotes/${l.id}`} className="font-medium underline-offset-4 hover:underline">
                {l.title}
              </Link>
              <p className={`mt-1 text-sm font-medium ${s.tone}`}>{s.text}</p>
              <p className="text-sm text-muted">
                Seu lance: {formatBRL(l.myBidCents)}
                {l.status !== "cancelled" && ` · ${l.status === "ended" ? "encerrado" : "termina"} em ${formatDateTime(l.endsAt)}`}
              </p>
              {l.receiptToken && (
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <Link href={`/comprovante/${l.receiptToken}`} className="font-medium underline underline-offset-4">
                    Ver comprovante
                  </Link>
                  <CopyLink path={`/comprovante/${l.receiptToken}`} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
