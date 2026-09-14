import { BookingInspector } from "@/components/admin/booking-inspector";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminBookingsPage() {
  return (
    <ShellMain>
      <BookingInspector />
    </ShellMain>
  );
}
