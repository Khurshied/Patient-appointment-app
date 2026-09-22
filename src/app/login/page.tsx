import { AuthPage } from "@/components/patient/AuthPage";
import "@/components/patient/patient.css";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
