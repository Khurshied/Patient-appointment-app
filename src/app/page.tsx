import { MarketingHome } from "@/components/patient/MarketingHome";
import "@/components/patient/patient.css";

export const metadata = {
  title: "Request a dental visit",
  description: "Register and request an in-person appointment. The practice confirms every slot.",
};

export default function HomePage() {
  return <MarketingHome />;
}
