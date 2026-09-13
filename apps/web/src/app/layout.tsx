import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope, Noto_Sans_Arabic } from "next/font/google";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { localeDirection, parseLocale } from "@/lib/locale";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-latin-face",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mshwar — Plan Your Lebanon Trip",
  description: "Discover. Plan. Book Lebanon. AI-powered itinerary builder.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get("mshwar-locale")?.value);

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <body className={`${manrope.variable} ${notoSansArabic.variable}`}>
        <LocaleProvider initialLocale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
