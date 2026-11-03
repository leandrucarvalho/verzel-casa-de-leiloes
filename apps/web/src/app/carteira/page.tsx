import { PageHeader } from "@/components/PageHeader";
import { RequireRole } from "@/components/RequireRole";
import { WalletView } from "@/components/WalletView";

export const metadata = { title: "Carteira · Casa de Leilões" };

export default function WalletPage() {
  return (
    <RequireRole role="bidder">
      <PageHeader title="Carteira" lead="O disponível é o que vale para o próximo lance." />
      <WalletView />
    </RequireRole>
  );
}
