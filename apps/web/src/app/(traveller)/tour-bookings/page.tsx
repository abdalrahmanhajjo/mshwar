import { ShellMain } from "@/components/shell/app-shell";
import { TourBookingsList } from "@/components/tours/tour-bookings-list";

export default function TourBookingsPage() {
  return (
    <ShellMain>
      <TourBookingsList />
    </ShellMain>
  );
}
