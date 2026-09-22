import { AppointmentDetail } from "@/components/patient/AppointmentDetail";

export const metadata = {
  title: "Appointment",
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppointmentDetail id={id} />;
}
