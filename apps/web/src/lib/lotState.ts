import { URGENT_MS } from "./countdown";
import type { IconName } from "@/components/Icon";
import type { Lot } from "./types";

// One visual state per lot. Colour is only half of it: every state has its own icon and label.
export type LotVisual = "live" | "soon" | "final" | "scheduled" | "sold" | "unsold" | "cancelled";

const HOUR = 3_600_000;

export interface VisualMeta {
  label: string;
  icon: IconName;
  // full class names so Tailwind can see them
  text: string;
  tint: string;
  border: string;
  bar: string;
}

export const visuals: Record<LotVisual, VisualMeta> = {
  live: { label: "Ao vivo", icon: "live", text: "text-live", tint: "bg-live/15", border: "border-live/40", bar: "bg-live" },
  soon: { label: "Termina em breve", icon: "clock", text: "text-urgent", tint: "bg-urgent/15", border: "border-urgent/40", bar: "bg-urgent" },
  final: { label: "Últimos minutos", icon: "alert", text: "text-danger", tint: "bg-danger/15", border: "border-danger/40", bar: "bg-danger" },
  scheduled: { label: "Agendado", icon: "calendar", text: "text-scheduled", tint: "bg-scheduled/15", border: "border-scheduled/40", bar: "bg-scheduled" },
  sold: { label: "Arrematado", icon: "trophy", text: "text-sold", tint: "bg-sold/15", border: "border-sold/40", bar: "bg-sold" },
  unsold: { label: "Encerrado", icon: "flag", text: "text-ended", tint: "bg-ended/15", border: "border-ended/40", bar: "bg-ended" },
  cancelled: { label: "Cancelado", icon: "ban", text: "text-danger", tint: "bg-danger/10", border: "border-danger/30", bar: "bg-danger" },
};

// `now` is the (server-corrected) clock in ms; 0 means "not ticking yet" and a live lot stays plain "live".
export function visualOf(lot: Pick<Lot, "status" | "result" | "endsAt">, now = 0): LotVisual {
  if (lot.status === "cancelled") return "cancelled";
  if (lot.status === "scheduled") return "scheduled";
  if (lot.status === "ended") return lot.result === "sold" ? "sold" : "unsold";
  if (!now) return "live";
  const left = new Date(lot.endsAt).getTime() - now;
  if (left <= URGENT_MS) return "final";
  if (left <= HOUR) return "soon";
  return "live";
}

export function labelOf(lot: Pick<Lot, "status" | "result" | "endsAt">, now = 0): string {
  const v = visualOf(lot, now);
  if (v === "unsold") return lot.result === "unsold" ? "Encerrado sem lances" : "Encerrado";
  return visuals[v].label;
}
