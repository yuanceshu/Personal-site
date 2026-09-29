import { CustomerWallet } from "@/components/works/demos/qintai-ticketing/customer/wallet-view";
import { CustomerShell } from "@/components/works/demos/qintai-ticketing/shell/customer-shell";

export default function QintaiTicketingWalletPage() {
  return (
    <CustomerShell>
      <CustomerWallet />
    </CustomerShell>
  );
}
