import { PortalBillingDetailClient } from "@/components/portal/portal-billing-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalBillingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PortalBillingDetailClient invoiceId={id} />;
}
