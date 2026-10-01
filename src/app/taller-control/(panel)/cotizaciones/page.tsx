import { listQuotations } from "./actions";
import { CotizacionesClient } from "./CotizacionesClient";

export const dynamic = "force-dynamic";

export default async function AdminCotizacionesPage() {
  const quotations = await listQuotations();
  return <CotizacionesClient initialQuotations={quotations} />;
}
