import { OrderPage } from "@/components/works/demos/island-travel/TravelPages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderPage id={id} />;
}
