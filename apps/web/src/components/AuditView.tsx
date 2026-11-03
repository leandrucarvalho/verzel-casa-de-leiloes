"use client";

import Link from "next/link";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";
import { Icon } from "./Icon";

interface Audit {
  lotId: string;
  title: string;
  verdict: { valid: true } | { valid: false; brokenAtSeq: number };
  anchored: boolean;
  anchoredToReceipt: boolean;
  bids: { seq: number; bidder: string; amountCents: number; placedAt: string; hash: string }[];
}

export function AuditView({ lotId }: { lotId: string }) {
  const { data: audit, error } = useFetch<Audit>(`/lots/${lotId}/audit`);

  if (error && !audit) return <p role="alert" className="text-danger">{error}</p>;
  if (!audit) return <div className="h-40 animate-pulse rounded-2xl bg-raised" aria-busy="true" />;

  const { verdict } = audit;

  return (
    <article>
      <Link href={`/lotes/${audit.lotId}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} /> Voltar ao lote
      </Link>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Auditoria · {audit.title}</h1>

      {verdict.valid ? (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-live/50 bg-live/10 p-5 text-live">
          <Icon name="shield" size={26} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-xl font-bold">Histórico íntegro</p>
            <p className="font-medium">Cada lance está encadeado ao anterior e nenhum foi alterado.</p>
            <p className="mt-1 text-sm font-normal text-muted">
              {audit.anchored
                ? "A âncora assinada do último lance também confere, então a remoção de lances do fim da cadeia seria detectada."
                : "Este lote é anterior à âncora assinada: a remoção do último lance só seria detectável depois do encerramento, pelo hash do comprovante."}
            </p>
          </div>
        </div>
      ) : (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-danger/60 bg-danger/10 p-5 text-danger">
          <Icon name="alert" size={26} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-xl font-bold">Histórico adulterado</p>
            <p className="font-medium">A cadeia se rompe no lance nº {verdict.brokenAtSeq}.</p>
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">Cadeia de lances</h2>
        {audit.bids.length === 0 ? (
          <p className="mt-3 text-muted">Este lote não recebeu lances.</p>
        ) : (
          <ol className="card mt-3 divide-y divide-line overflow-hidden">
            {audit.bids.map((b) => {
              const broken = !verdict.valid && b.seq >= verdict.brokenAtSeq;
              return (
                <li key={b.seq} className={`px-4 py-3 ${broken ? "bg-danger/10" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 font-medium">
                      <span>
                        #{b.seq} · {b.bidder}
                      </span>
                      {broken && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
                          <Icon name="alert" size={12} /> cadeia rompida
                        </span>
                      )}
                    </p>
                    <p className="num font-display text-lg font-bold">{formatBRL(b.amountCents)}</p>
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
          quebra a cadeia daquele ponto em diante. A chave do HMAC fica no servidor, fora do banco de dados, e é ela que também
          assina a âncora do último lance.
        </p>
      </section>
    </article>
  );
}
