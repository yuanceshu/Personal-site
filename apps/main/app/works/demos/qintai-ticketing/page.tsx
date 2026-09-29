import { CustomerHome } from "@/components/works/demos/qintai-ticketing/customer/home-view";
import { CustomerShell } from "@/components/works/demos/qintai-ticketing/shell/customer-shell";

export default function QintaiTicketingHomePage() {
  return (
    <CustomerShell>
      <CustomerHome />
    </CustomerShell>
  );
}
