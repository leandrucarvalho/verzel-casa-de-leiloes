"use client";

import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (insecure context or denied): the link is still on the receipt page
    }
  }

  return (
    <button type="button" onClick={copy} className="text-muted underline underline-offset-4 hover:text-ink">
      {copied ? "Link copiado" : "Copiar link para compartilhar"}
    </button>
  );
}
