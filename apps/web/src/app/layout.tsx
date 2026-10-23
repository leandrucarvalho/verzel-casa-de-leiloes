import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { themeScript } from "@/components/ThemeToggle";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-loaded", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-serif-loaded", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Casa de Leilões",
  description: "Leilões online com lances ao vivo e histórico auditável.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
