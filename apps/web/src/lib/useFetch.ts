"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

// One-shot GET for pages that only need to load data and reload it after a mutation.
export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<{ path: string; data: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api<T>(path);
        if (cancelled) return;
        setState({ path, data });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Não foi possível carregar os dados.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data: state?.path === path ? state.data : null, error, reload };
}
