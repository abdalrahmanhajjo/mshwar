"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
export function BookingGate() {
  const { user } = useAuth();
  const { t } = useLocale();
  const locked = Boolean(user && !user.email_verified);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bookings")}</CardTitle>
        <CardDescription>
          {locked ? (
            <>
              {t("verifyToBook")}{" "}
              <Link className="text-brand underline-offset-4 hover:underline" href="/verify-email">
                {t("verifyEmail")}
              </Link>
            </>
          ) : (
            t("travellerFooter")
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
