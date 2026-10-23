import { PanelView } from "@/components/PanelView";
import { RequireRole } from "@/components/RequireRole";

export const metadata = { title: "Painel do leiloeiro · Casa de Leilões" };

export default function PanelPage() {
  return (
    <RequireRole role="auctioneer">
      <h1 className="mb-6 text-3xl font-semibold">Painel do leiloeiro</h1>
      <PanelView />
    </RequireRole>
  );
}
