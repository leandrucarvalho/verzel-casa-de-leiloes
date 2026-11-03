import { PageHeader } from "@/components/PageHeader";
import { PanelView } from "@/components/PanelView";
import { RequireRole } from "@/components/RequireRole";

export const metadata = { title: "Painel do leiloeiro · Casa de Leilões" };

export default function PanelPage() {
  return (
    <RequireRole role="auctioneer">
      <PageHeader title="Painel do leiloeiro" lead="Crie lotes, acompanhe o andamento e veja o que já foi vendido." />
      <PanelView />
    </RequireRole>
  );
}
