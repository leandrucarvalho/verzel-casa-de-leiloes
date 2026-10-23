import { AuditView } from "@/components/AuditView";

export const metadata = { title: "Auditoria · Casa de Leilões" };

export default async function AuditPage(props: PageProps<"/auditoria/[id]">) {
  const { id } = await props.params;
  return <AuditView lotId={id} />;
}
