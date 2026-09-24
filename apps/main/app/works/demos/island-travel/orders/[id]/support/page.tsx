import { SupportPage } from "@/components/works/demos/island-travel/SupportPage";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportPage key={id} id={id} />;
}
