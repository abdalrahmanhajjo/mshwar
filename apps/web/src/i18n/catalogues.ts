/**
 * en / ar / fr message catalogues.
 *
 * Routing stays on the existing locale-prefix middleware instead of next-intl
 * so we do not run two routers. These catalogues are the same shape next-intl
 * would load. Key names are camelCase and grouped by surface in dedicated
 * modules (`messages`, `browseCopy`, `hubCopy`, `businessCopy`, `adminCopy`,
 * `privacyCopy`, `plannerCopy`, `checkoutCopy`).
 */
export { messages } from "@/lib/messages";
export { browseCopy } from "@/lib/browse-copy";
export { businessCopy } from "@/lib/business-copy";
export { hubCopy } from "@/lib/hub-copy";
export { privacyCopy } from "@/lib/privacy-copy";
export { plannerCopy } from "@/lib/planner-copy";
export { checkoutCopy } from "@/lib/checkout-copy";
export { adminCopy } from "@/lib/admin-copy";
export { LOCALES, type Locale } from "@/lib/locale";
export { catalogueRegistry, catalogueParityErrors } from "@/i18n/parity";
export { translate, interpolate, MissingTranslationError } from "@/i18n/translate";
export { formatCurrency, formatDate, formatNumber, formatPlural } from "@/i18n/format";
