import { CustomerShowDetail } from "@/components/works/demos/qintai-ticketing/customer/show-view";
import { CustomerShell } from "@/components/works/demos/qintai-ticketing/shell/customer-shell";

export default async function QintaiTicketingShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CustomerShell>
      <CustomerShowDetail productId={id} />
    </CustomerShell>
  );
}
