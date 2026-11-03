"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

// Runs before hydration (see layout) so there is no flash of the wrong theme. Dark unless the user chose light.
export const themeScript = `try{if(localStorage.getItem("leilao.theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => true,
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
      className="btn btn-ghost !min-w-11 !p-0"
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
