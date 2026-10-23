"use client";

import { useSyncExternalStore } from "react";

// Runs before hydration (see layout) so there is no flash of the wrong theme.
export const themeScript = `try{var t=localStorage.getItem("leilao.theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  function toggle() {
    document.documentElement.classList.toggle("dark", !dark);
    try {
      localStorage.setItem("leilao.theme", !dark ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
    >
      {dark ? "☀ Claro" : "☾ Escuro"}
    </button>
  );
}
