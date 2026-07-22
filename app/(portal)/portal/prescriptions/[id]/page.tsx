import { PortalPrescriptionDetailClient } from "@/components/portal/portal-prescription-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalPrescriptionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PortalPrescriptionDetailClient prescriptionId={id} />;
}
