"use client";

import Image from "next/image";
import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";
import { CopyLink } from "./CopyLink";

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
  if (!r) return <div className="h-40 animate-pulse rounded-xl bg-line/60" aria-busy="true" />;

  return (
    <article className="mx-auto max-w-2xl rounded-xl border border-line bg-surface p-6">
      <p className="text-xs tracking-wide text-muted uppercase">Comprovante de arremate</p>
      <h1 className="mt-1 text-2xl font-semibold">{r.title}</h1>
      <div className="mt-4 flex gap-4">
        <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg bg-paper">
          {r.imageUrl && <Image src={r.imageUrl} alt={r.title} fill unoptimized sizes="128px" className="object-contain" />}
        </div>
        <dl className="grid flex-1 content-start gap-y-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-muted">Valor final</dt>
          <dd className="font-semibold">{formatBRL(r.winningBidCents)}</dd>
          <dt className="text-muted">Arrematante</dt>
          <dd>{r.winner}</dd>
          <dt className="text-muted">Leiloeiro</dt>
          <dd>{r.auctioneer}</dd>
          <dt className="text-muted">Encerrado em</dt>
          <dd>{formatDateTime(r.settledAt)}</dd>
        </dl>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-xs tracking-wide text-muted uppercase">Hash final da cadeia de lances</p>
        <p className="mt-1 font-mono text-xs break-all">{r.finalHash}</p>
      </div>
      <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/auditoria/${r.lotId}`} className="font-medium underline underline-offset-4">
          Auditar o histórico de lances
        </Link>
        <CopyLink path={`/comprovante/${r.token}`} />
      </p>
    </article>
  );
}
