import { ShellMain } from "@/components/shell/app-shell";
import { BookingGate } from "@/components/auth/booking-gate";

export default function BookingsPage() {
  return (
    <ShellMain>
      <BookingGate />
    </ShellMain>
  );
}
