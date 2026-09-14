"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY, readCookieConsent, saveCookieConsent, securityFetch } from "@/lib/security";

export const consentCopy = {
  en: { title: "Privacy choices", personal: "Use my saved preferences to personalise future plans", marketing: "Send me marketing messages", save: "Save choices", saved: "Choices saved. You can withdraw either consent here.", error: "Unable to load or save choices. Please retry.", cookies: "Cookie choices", body: "Essential storage keeps you signed in and remembers your language. Optional analytics is off by default.", essential: "Essential only", analytics: "Allow optional analytics", manage: "Change cookie choices" },
  fr: { title: "Choix de confidentialité", personal: "Utiliser mes préférences enregistrées pour personnaliser les prochains plans", marketing: "M’envoyer des messages marketing", save: "Enregistrer", saved: "Choix enregistrés. Vous pouvez retirer chaque consentement ici.", error: "Impossible de charger ou enregistrer les choix. Réessayez.", cookies: "Choix des cookies", body: "Le stockage essentiel maintient la session et mémorise la langue. L’analyse facultative est désactivée par défaut.", essential: "Essentiels uniquement", analytics: "Autoriser l’analyse facultative", manage: "Modifier les choix des cookies" },
  ar: { title: "خيارات الخصوصية", personal: "استخدام تفضيلاتي المحفوظة لتخصيص الخطط القادمة", marketing: "إرسال رسائل تسويقية إليّ", save: "حفظ الخيارات", saved: "حُفظت الخيارات. يمكنك سحب كل موافقة هنا.", error: "تعذّر تحميل الخيارات أو حفظها. حاول مجدداً.", cookies: "خيارات ملفات الارتباط", body: "يحافظ التخزين الأساسي على جلسة الدخول واللغة. التحليلات الاختيارية معطّلة افتراضياً.", essential: "الأساسية فقط", analytics: "السماح بالتحليلات الاختيارية", manage: "تغيير خيارات ملفات الارتباط" },
};

export function ConsentControls() {
  const { locale } = useLocale();
  const copy = consentCopy[locale];
  const [values, setValues] = useState({ personalisation: false, marketing: false });
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    securityFetch("/api/v1/privacy/consents", { credentials: "include" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) { setValues({ personalisation: data.personalisation === true, marketing: data.marketing === true }); setReady(true); }
    }).catch(() => { if (active) setMessage(copy.error); });
    return () => { active = false; };
  }, [copy.error]);
  async function save() {
    setPending(true); setMessage("");
    try {
      const response = await securityFetch("/api/v1/privacy/consents", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error();
      setMessage(copy.saved);
    } catch { setMessage(copy.error); } finally { setPending(false); }
  }
  return <section className="grid gap-4 rounded-panel border border-border p-6" aria-labelledby="consent-title">
    <h2 id="consent-title" className="text-xl font-semibold">{copy.title}</h2>
    <label className="flex items-start gap-3"><input type="checkbox" disabled={!ready || pending} checked={values.personalisation} onChange={e => setValues({ ...values, personalisation: e.target.checked })} />{copy.personal}</label>
    <label className="flex items-start gap-3"><input type="checkbox" disabled={!ready || pending} checked={values.marketing} onChange={e => setValues({ ...values, marketing: e.target.checked })} />{copy.marketing}</label>
    <Button disabled={!ready || pending} onClick={() => void save()}>{copy.save}</Button>
    <p role="status">{message}</p>
  </section>;
}

const subscribeChoices = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("mshwar:consent", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("mshwar:consent", callback); };
};
const hasCookieChoice = () => { try { return !!localStorage.getItem(COOKIE_CONSENT_KEY); } catch { return false; } };

export function CookieChoices() {
  const { locale } = useLocale();
  const copy = consentCopy[locale];
  const chosen = useSyncExternalStore(subscribeChoices, hasCookieChoice, () => true);
  const [manualOpen, setOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? !chosen;
  function choose(analytics: boolean) { saveCookieConsent(analytics); setOpen(false); }
  return <aside className="border-t border-border bg-surface-raised p-4" aria-label={copy.cookies}>
    {open ? <div className="mx-auto grid max-w-3xl gap-3"><h2 className="font-semibold">{copy.cookies}</h2><p>{copy.body}</p>
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => choose(false)}>{copy.essential}</Button><Button variant="outline" onClick={() => choose(true)}>{copy.analytics}</Button></div>
    </div> : <button type="button" className="underline" onClick={() => { readCookieConsent(); setOpen(true); }}>{copy.manage}</button>}
  </aside>;
}
