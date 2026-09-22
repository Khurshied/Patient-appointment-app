import { Suspense } from "react";
import { RequestFlow } from "@/components/patient/RequestFlow";

export const metadata = {
  title: "Request a visit",
};

export default function RequestPage() {
  return (
    <Suspense fallback={<p className="pt-muted">Loading request form…</p>}>
      <RequestFlow />
    </Suspense>
  );
}
