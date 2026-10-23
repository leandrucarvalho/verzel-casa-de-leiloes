const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (cents: number) => brl.format(cents / 100);

// "12,50", "1.234,56", "12.5" -> cents; null when it is not a valid positive amount.
// pt-BR: the dot groups thousands, except a lone "12.5"/"12.50" which reads as decimals.
export function parseBRLToCents(input: string): number | null {
  const text = input.trim();
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d+\.\d{1,2}$/.test(text)
      ? text
      : text.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 ? cents : null;
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
