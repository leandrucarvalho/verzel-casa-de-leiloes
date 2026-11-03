"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth";
import { Icon } from "./Icon";

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
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-3xl font-bold">{isRegister ? "Criar conta" : "Entrar"}</h1>
        <p className="mt-1 text-sm text-muted">
          {isRegister ? "Escolha como quer participar dos leilões." : "Acesse sua carteira, seus lances e seus lotes."}
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <>
              <label className="block text-sm font-medium">
                Apelido
                <input name="nickname" required minLength={2} maxLength={30} className="field mt-1" />
              </label>
              <fieldset>
                <legend className="text-sm font-medium">Quero</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <label className="card flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
                    <input type="radio" name="role" value="bidder" defaultChecked className="accent-[var(--brand)]" /> Dar lances
                  </label>
                  <label className="card flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
                    <input type="radio" name="role" value="auctioneer" className="accent-[var(--brand)]" /> Leiloar itens
                  </label>
                </div>
              </fieldset>
            </>
          )}
          <label className="block text-sm font-medium">
            E-mail
            <input name="email" type="email" required autoComplete="email" className="field mt-1" />
          </label>
          <label className="block text-sm font-medium">
            Senha
            <div className="relative mt-1">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={isRegister ? 8 : undefined}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="field !pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
              </button>
            </div>
            {isRegister && <span className="text-xs font-normal text-muted">Mínimo de 8 caracteres.</span>}
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn btn-brand w-full">
            {busy ? "Aguarde…" : isRegister ? "Criar conta" : "Entrar"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {isRegister ? (
          <>
            Já tem conta?{" "}
            <Link href="/login" className="link font-semibold text-ink">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Novo por aqui?{" "}
            <Link href="/cadastro" className="link font-semibold text-ink">
              Criar conta
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
