import { searchCatalogProducts } from "@/app/taller-control/(panel)/cotizaciones/actions";
import { CotizarClient } from "./CotizarClient";

export const dynamic = "force-dynamic";

export default async function CotizarPage() {
  const initialProducts = await searchCatalogProducts("");
  return <CotizarClient initialProducts={initialProducts} />;
}
