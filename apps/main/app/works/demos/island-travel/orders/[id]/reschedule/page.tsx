import { ReschedulePage } from "@/components/works/demos/island-travel/AfterSalesPages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReschedulePage id={id} />;
}
