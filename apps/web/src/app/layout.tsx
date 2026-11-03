import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/Header";
import { themeScript } from "@/components/ThemeToggle";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-loaded", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-display-loaded", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Casa de Leilões",
  description: "Leilões online com lances ao vivo e histórico auditável.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink">
            Pular para o conteúdo
          </a>
          <Header />
          <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
