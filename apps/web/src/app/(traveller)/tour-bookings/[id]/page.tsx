import { ShellMain } from "@/components/shell/app-shell";
import { TourBookingView } from "@/components/tours/tour-booking-view";

export default async function TourBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <TourBookingView bookingId={id} role="traveller" />
    </ShellMain>
  );
}
