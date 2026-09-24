import { RefundPage } from "@/components/works/demos/island-travel/JourneyPages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RefundPage id={id} />;
}
