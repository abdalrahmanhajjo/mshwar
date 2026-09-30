import type { ComponentProps } from "react";
import { safeHttpUrl } from "@/lib/safe-url";

type UserLinkProps = Omit<ComponentProps<"a">, "href" | "target" | "rel"> & {
  href: string | null | undefined;
  /** Written by users (guides, travellers, partners) rather than the editorial team. */
  ugc?: boolean;
};

/**
 * An outside link whose address came from data (security plan SEC-38). It opens in a new tab
 * without handing the page to the other site, and anything but http(s) renders as plain text.
 */
export function UserLink({ href, ugc = false, children, className, ...rest }: UserLinkProps) {
  const safe = safeHttpUrl(href);
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a
      {...rest}
      href={safe}
      target="_blank"
      rel={ugc ? "noopener noreferrer nofollow ugc" : "noopener noreferrer"}
      className={className}
    >
      {children}
    </a>
  );
}
