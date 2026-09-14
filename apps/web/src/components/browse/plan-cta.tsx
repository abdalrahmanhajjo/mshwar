"use client";

import { ArrowUpRight, Leaf, Mountain, Sparkles, Waves } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";

export function PlanSplitCta() {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const notes = locale === "ar" ? ["أرز عريق. إيقاع أهدأ.", "طاولة تستحق البقاء.", "اترك العجلة وراءك."] : locale === "fr" ? ["Des cèdres anciens. Un rythme plus doux.", "Une table où prendre son temps.", "Laissez la hâte derrière vous."] : ["Ancient cedars. A slower pace.", "A table worth staying at.", "Leave the rush behind."];
  const icons = [Mountain, Leaf, Waves];
  return (
    <section className="home-plan">
      <div className="home-plan-copy">
        <p className="home-kicker"><Sparkles size={16} aria-hidden />{locale === "en" ? "Your day, beautifully put together" : copy.onePlanKicker}</p>
        <h2>{locale === "en" ? <>A few ideas.<br />One great <em>plan.</em></> : copy.onePlanTitle}</h2>
        <p>{locale === "en" ? <>Tell us your mood, your budget, and who’s coming.<br />We’ll help you connect the dots.</> : copy.onePlanBody}</p>
        <Button asChild className="home-plan-button"><LocaleLink href="/plan">{copy.buildTrip}<ArrowUpRight size={16} aria-hidden /></LocaleLink></Button>
      </div>
      <div className="home-itinerary">
        <p className="home-kicker">{locale === "en" ? "Your next Sunday" : locale === "fr" ? "Votre prochain dimanche" : "الأحد القادم"}</p>
        <ol>
          {[copy.onePlanPoint1, copy.onePlanPoint2, copy.onePlanPoint3].map((point, index) => {
            const Icon = icons[index];
            return <li key={point}><div><p className="home-time">{["09:30", "12:30", "16:00"][index]} · {locale === "en" ? ["A fresh start", "Time to recharge", "The scenic route"][index] : `${index + 1}`}</p><h3>{point}</h3><p>{notes[index]}</p></div><Icon size={19} aria-hidden /></li>;
          })}
        </ol>
        <p className="home-itinerary-note">{locale === "en" ? "An idea to make your own. Timing is illustrative." : copy.sampleDisclaimer}</p>
      </div>
    </section>
  );
}

export function SoftPlanCta() {
  const copy = useBrowseCopy();
  return (
    <section className="flex flex-col items-start justify-between gap-4 rounded-card bg-surface-sunken p-6 md:flex-row md:items-center md:p-8">
      <div>
        <h2 className="text-heading font-semibold tracking-tight">{copy.cantDecide}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.cantDecideBody}</p>
      </div>
      <Button asChild className="rounded-pill">
        <LocaleLink href="/plan">{copy.planMyTrip}</LocaleLink>
      </Button>
    </section>
  );
}
