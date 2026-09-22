import type { ReactNode } from "react";
import { StaffShell } from "../../components/staff/StaffShell";
import "../../components/staff/staff.css";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
