import { ReceiptView } from "@/components/ReceiptView";

export const metadata = { title: "Comprovante · Casa de Leilões" };

export default async function ReceiptPage(props: PageProps<"/comprovante/[token]">) {
  const { token } = await props.params;
  return <ReceiptView token={token} />;
}
