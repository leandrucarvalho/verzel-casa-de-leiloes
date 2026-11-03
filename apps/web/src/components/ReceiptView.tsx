"use client";

import Image from "next/image";
import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";
import { CopyLink } from "./CopyLink";
import { Icon } from "./Icon";

interface Receipt {
  token: string;
  lotId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
  winningBidCents: number;
  winner: string;
  auctioneer: string;
  settledAt: string;
  finalHash: string;
}

export function ReceiptView({ token }: { token: string }) {
  const { data: r, error } = useFetch<Receipt>(`/receipts/${token}`);

  if (error && !r) return <p role="alert" className="text-danger">{error}</p>;
  if (!r) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;

  return (
    <article className="card mx-auto max-w-2xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-sold/10 px-6 py-4 text-sold">
        <Icon name="trophy" size={22} />
        <p className="eyebrow !text-current">Comprovante de arremate</p>
      </div>
      <div className="p-6">
        <h1 className="text-2xl font-bold">{r.title}</h1>
        <div className="mt-5 flex gap-5">
          <div className="relative h-44 w-36 shrink-0 overflow-hidden rounded-xl bg-mat">
            {r.imageUrl && <Image src={r.imageUrl} alt={r.title} fill unoptimized sizes="144px" className="object-contain p-1" />}
          </div>
          <dl className="grid flex-1 content-start gap-y-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-5">
            <dt className="text-muted">Valor final</dt>
            <dd className="num font-display text-2xl font-bold">{formatBRL(r.winningBidCents)}</dd>
            <dt className="text-muted">Arrematante</dt>
            <dd>{r.winner}</dd>
            <dt className="text-muted">Leiloeiro</dt>
            <dd>{r.auctioneer}</dd>
            <dt className="text-muted">Encerrado em</dt>
            <dd>{formatDateTime(r.settledAt)}</dd>
          </dl>
        </div>
        <div className="mt-6 rounded-xl bg-raised p-4">
          <p className="eyebrow">Hash final da cadeia de lances</p>
          <p className="mt-1 font-mono text-xs break-all">{r.finalHash}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/auditoria/${r.lotId}`} className="btn btn-brand btn-sm">
            <Icon name="shield" size={16} /> Auditar o histórico de lances
          </Link>
          <CopyLink path={`/comprovante/${r.token}`} />
        </div>
      </div>
    </article>
  );
}
