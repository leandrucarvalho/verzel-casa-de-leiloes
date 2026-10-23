"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-brass";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError(null);
    try {
      const user = isRegister
        ? await register({ email, password, nickname: String(form.get("nickname")), role: form.get("role") as Role })
        : await login(email, password);
      router.push(user.role === "auctioneer" ? "/painel" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-semibold">{isRegister ? "Criar conta" : "Entrar"}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {isRegister && (
          <>
            <label className="block text-sm">
              Apelido
              <input name="nickname" required minLength={2} maxLength={30} className={input} />
            </label>
            <fieldset>
              <legend className="text-sm">Quero</legend>
              <div className="mt-1 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="bidder" defaultChecked /> Dar lances
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="auctioneer" /> Leiloar itens
                </label>
              </div>
            </fieldset>
          </>
        )}
        <label className="block text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="block text-sm">
          Senha
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
              className={`${input} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="M3 3l18 18" />}
              </svg>
            </button>
          </div>
          {isRegister && <span className="text-xs text-muted">Mínimo de 8 caracteres.</span>}
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brass px-4 py-2 font-medium text-brass-ink disabled:opacity-60"
        >
          {busy ? "Aguarde…" : isRegister ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {isRegister ? (
          <>
            Já tem conta? <Link href="/login" className="underline underline-offset-4">Entrar</Link>
          </>
        ) : (
          <>
            Novo por aqui? <Link href="/cadastro" className="underline underline-offset-4">Criar conta</Link>
          </>
        )}
      </p>
    </div>
  );
}
