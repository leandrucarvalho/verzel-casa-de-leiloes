export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const TOKEN_KEY = "leilao.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, message, ...details } = data as Record<string, unknown>;
    throw new ApiError(res.status, String(error ?? "error"), String(message ?? "Algo deu errado."), details);
  }
  return data as T;
}
