import { LotRoom } from "@/components/LotRoom";

export const metadata = { title: "Lote · Casa de Leilões" };

export default async function LotPage(props: PageProps<"/lotes/[id]">) {
  const { id } = await props.params;
  return <LotRoom lotId={id} />;
}
