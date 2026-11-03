import { PageHeader } from "@/components/PageHeader";
import { RequireRole } from "@/components/RequireRole";
import { WinsView } from "@/components/WinsView";

export const metadata = { title: "Meus arremates · Casa de Leilões" };

export default function WinsPage() {
  return (
    <RequireRole role="bidder">
      <PageHeader title="Meus arremates" lead="Lotes em que você deu lances, com a sua posição e os comprovantes." />
      <WinsView />
    </RequireRole>
  );
}
