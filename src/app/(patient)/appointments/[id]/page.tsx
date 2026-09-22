import { AppointmentDetail } from "@/components/patient/AppointmentDetail";

export const metadata = {
  title: "Appointment",
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  return <AppointmentDetail id={id} />;
}
