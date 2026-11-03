import { labelOf, visualOf, visuals } from "@/lib/lotState";
import type { Lot } from "@/lib/types";
import { Icon } from "./Icon";

// The state of a lot at a glance: hue + icon + word, so it reads without colour too.
export function StatusBadge({
  lot,
  now = 0,
  className = "",
}: {
  lot: Pick<Lot, "status" | "result" | "endsAt">;
  now?: number;
  className?: string;
}) {
  const v = visualOf(lot, now);
  const meta = visuals[v];
  const pulsing = v === "live" || v === "soon" || v === "final";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.text} ${meta.tint} ${meta.border} ${className}`}
    >
      {pulsing ? <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden /> : <Icon name={meta.icon} size={14} />}
      {labelOf(lot, now)}
    </span>
  );
}
