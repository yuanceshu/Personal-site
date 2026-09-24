import { OrderPage } from "@/components/works/demos/island-travel/TravelPages";
import { ProductOrderPage } from "@/components/works/demos/island-travel/ProductPages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return id.startsWith("DP-") ? <ProductOrderPage id={id} /> : <OrderPage id={id} />;
}
