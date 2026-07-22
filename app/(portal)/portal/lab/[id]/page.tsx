import { PortalLabDetailClient } from "@/components/portal/portal-lab-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalLabDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PortalLabDetailClient labTestId={id} />;
}
