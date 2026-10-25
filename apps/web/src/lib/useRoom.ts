"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, api, ApiError } from "./api";
import type { Room } from "./types";

const POLL_MS = 5_000;
const NOTICE_MS = 8_000;

// Keeps a lot room fresh: SSE pings trigger an immediate refetch, and a slow poll is the safety net
// (proxies that buffer streams, a dropped connection, or the clock moving the lot into another phase).
export function useRoom(lotId: string, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [extended, setExtended] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [gone, setGone] = useState(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const lastEnd = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const fresh = await api<Room>(`/lots/${lotId}/room`);
        if (cancelled) return;
        const end = new Date(fresh.lot.endsAt).getTime();
        if (lastEnd.current !== null && end > lastEnd.current) {
          setExtended(true);
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setExtended(false), NOTICE_MS);
        }
        lastEnd.current = end;
        setRoom(fresh);
        setClockOffset(new Date(fresh.serverTime).getTime() - Date.now());
        setError(null);
        setGone(false);
      } catch (err) {
        if (cancelled) return;
        // a room we already showed now answers 404: the auctioneer cancelled the lot
        if (err instanceof ApiError && err.status === 404 && lastEnd.current !== null) setGone(true);
        else setError(err instanceof ApiError ? err.message : "Não foi possível carregar o lote.");
      }
    };
    loadRef.current = load;
    load();

    const poll = setInterval(load, POLL_MS);
    const source = new EventSource(`${API_URL}/lots/${lotId}/events`);
    source.addEventListener("update", load);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(noticeTimer);
      source.close();
    };
    // userId: refetch when the user logs in or out, so "me" is right
  }, [lotId, userId, attempt]);

  const refresh = useCallback(() => loadRef.current(), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { room, error, clockOffset, extended, gone, refresh, retry };
}
