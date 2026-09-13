import * as React from "react";

const Link = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
  ({ href, children, ...props }, ref) => (
    <a href={href} ref={ref} {...props}>
      {children}
    </a>
  ),
);
Link.displayName = "Link";

export default Link;
