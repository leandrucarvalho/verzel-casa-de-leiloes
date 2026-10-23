import { RequireRole } from "@/components/RequireRole";
import { WalletView } from "@/components/WalletView";

export const metadata = { title: "Carteira · Casa de Leilões" };

export default function WalletPage() {
  return (
    <RequireRole role="bidder">
      <h1 className="mb-6 text-3xl font-semibold">Carteira</h1>
      <WalletView />
    </RequireRole>
  );
}
