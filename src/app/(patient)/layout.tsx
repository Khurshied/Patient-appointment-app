import { PatientShell } from "@/components/patient/PatientShell";
import "@/components/patient/patient.css";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <PatientShell>{children}</PatientShell>;
}
