import { CustomerShows } from "@/components/works/demos/qintai-ticketing/customer/shows-view";
import { CustomerShell } from "@/components/works/demos/qintai-ticketing/shell/customer-shell";

export default function QintaiTicketingShowsPage() {
  return (
    <CustomerShell>
      <CustomerShows />
    </CustomerShell>
  );
}
