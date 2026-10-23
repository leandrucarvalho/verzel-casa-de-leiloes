import { RequireRole } from "@/components/RequireRole";
import { WinsView } from "@/components/WinsView";

export const metadata = { title: "Meus arremates · Casa de Leilões" };

export default function WinsPage() {
  return (
    <RequireRole role="bidder">
      <h1 className="mb-6 text-3xl font-semibold">Meus arremates</h1>
      <WinsView />
    </RequireRole>
  );
}
