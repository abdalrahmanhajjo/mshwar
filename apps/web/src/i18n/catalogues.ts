/**
 * en / ar / fr message catalogues.
 *
 * Routing stays on the existing locale-prefix middleware instead of next-intl
 * so we do not run two routers. These catalogues are the same shape next-intl
 * would load.
 */
export { messages } from "@/lib/messages";
export { browseCopy } from "@/lib/browse-copy";
export { businessCopy } from "@/lib/business-copy";
export { hubCopy } from "@/lib/hub-copy";
export { privacyCopy } from "@/lib/privacy-copy";
export { plannerCopy } from "@/lib/planner-copy";
