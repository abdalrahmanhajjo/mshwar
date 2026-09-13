import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Manrope, Noto_Sans_Arabic } from "next/font/google";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { SignedInLocaleSync } from "@/components/shell/locale-sync";
import { LOCALE_COOKIE, LOCALE_HEADER, localeDirection, parseLocale } from "@/lib/locale";
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
  const headerStore = await headers();
  const locale = parseLocale(headerStore.get(LOCALE_HEADER) ?? cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <body className={`${manrope.variable} ${notoSansArabic.variable}`}>
        <LocaleProvider initialLocale={locale}>
          <AuthProvider>
            <SignedInLocaleSync />
            {children}
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
