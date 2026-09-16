"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { useAdminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const copy = useAdminCopy();
  return <PageHeader eyebrow={copy.consoleKicker} title={title} description={description} actions={actions} />;
}

/** Audit-log reason input shared by every destructive or state-changing admin action. */
export function ReasonField({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const copy = useAdminCopy();
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{copy.reasonLabel}</Label>
      <Input id={id} aria-label="reason" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-card border border-border-subtle bg-surface-raised", className)}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-text-muted">
        {label}
      </td>
    </tr>
  );
}
