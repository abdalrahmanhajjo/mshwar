import { BusinessShell } from "@/components/shell/app-shell";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <BusinessShell>{children}</BusinessShell>;
}
