import { CustomerWaitlist } from "@/components/works/demos/qintai-ticketing/customer/waitlist-view";
import { CustomerShell } from "@/components/works/demos/qintai-ticketing/shell/customer-shell";

export default function QintaiTicketingWaitlistPage() {
  return (
    <CustomerShell>
      <CustomerWaitlist />
    </CustomerShell>
  );
}
