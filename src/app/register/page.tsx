import { AuthPage } from "@/components/patient/AuthPage";
import "@/components/patient/patient.css";

export const metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return <AuthPage mode="register" />;
}
