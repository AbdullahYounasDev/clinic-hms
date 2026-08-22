import { Metadata } from "next";
import { DepartmentsClient } from "@/components/departments/departments-client";

export const metadata: Metadata = {
  title: "Departments | ClinicHMS",
  description: "Manage clinical and administrative departments",
};

export default function DepartmentsPage() {
  return <DepartmentsClient />;
}
