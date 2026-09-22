import { Suspense } from "react";
import { AppointmentList } from "@/components/patient/AppointmentList";

export const metadata = {
  title: "My appointments",
};

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<p className="pt-muted">Loading appointments…</p>}>
      <AppointmentList />
    </Suspense>
  );
}
