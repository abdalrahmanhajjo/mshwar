import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShellMain } from "@/components/shell/app-shell";

export function ShellPage({ title, description }: { title: string; description: string }) {
  return (
    <ShellMain>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </ShellMain>
  );
}
