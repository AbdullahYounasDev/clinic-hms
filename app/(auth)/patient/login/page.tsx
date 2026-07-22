import { Suspense } from "react";
import { PatientLoginForm } from "@/components/auth/patient-login-form";
import Loading from "@/components/Loading";

export default function PatientLoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PatientLoginForm />
    </Suspense>
  );
}
