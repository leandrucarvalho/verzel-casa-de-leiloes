import type { ReactNode } from "react";

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {lead && <p className="mt-1 max-w-xl text-muted">{lead}</p>}
      </div>
      {children}
    </div>
  );
}
