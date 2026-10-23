"use client";

import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";

interface Audit {
  lotId: string;
  title: string;
  verdict: { valid: true } | { valid: false; brokenAtSeq: number };
  anchoredToReceipt: boolean;
  bids: { seq: number; bidder: string; amountCents: number; placedAt: string; hash: string }[];
}

export function AuditView({ lotId }: { lotId: string }) {
  const { data: audit, error } = useFetch<Audit>(`/lots/${lotId}/audit`);

  if (error && !audit) return <p role="alert" className="text-danger">{error}</p>;
  if (!audit) return <div className="h-40 animate-pulse rounded-xl bg-line/60" aria-busy="true" />;

  const { verdict } = audit;

  return (
    <article>
      <Link href={`/lotes/${audit.lotId}`} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
        ← Voltar ao lote
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Auditoria · {audit.title}</h1>

      {verdict.valid ? (
        <p role="status" className="mt-5 rounded-xl border border-live bg-live/10 p-4 font-medium text-live">
          Histórico íntegro: cada lance está encadeado ao anterior e nenhum foi alterado.
          {!audit.anchoredToReceipt && (
            <span className="mt-1 block text-sm font-normal text-muted">
              O lote ainda não foi encerrado, então a remoção do último lance não seria detectável. Após o encerramento, o comprovante
              fixa o hash final.
            </span>
          )}
        </p>
      ) : (
        <p role="alert" className="mt-5 rounded-xl border border-danger bg-danger/10 p-4 font-medium text-danger">
          Histórico adulterado: a cadeia se rompe no lance nº {verdict.brokenAtSeq}.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Cadeia de lances</h2>
        {audit.bids.length === 0 ? (
          <p className="mt-3 text-muted">Este lote não recebeu lances.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {audit.bids.map((b) => {
              const broken = !verdict.valid && b.seq >= verdict.brokenAtSeq;
              return (
                <li key={b.seq} className={`px-4 py-3 ${broken ? "bg-danger/10" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      #{b.seq} · {b.bidder}
                    </p>
                    <p className="font-semibold tabular-nums">{formatBRL(b.amountCents)}</p>
                  </div>
                  <p className="text-xs text-muted">{formatDateTime(b.placedAt)}</p>
                  <p className="mt-1 font-mono text-xs break-all text-muted">{b.hash}</p>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Cada hash é um HMAC-SHA256 que combina o hash do lance anterior com os dados do lance. Mudar qualquer valor ou ordem
          quebra a cadeia daquele ponto em diante. A chave do HMAC fica no servidor, fora do banco de dados.
        </p>
      </section>
    </article>
  );
}
