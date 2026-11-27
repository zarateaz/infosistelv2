import Link from "next/link";
import { getInternetClients } from "../cobranza-internet/internetActions";
import { ClientesRetiradosClient } from "./ClientesRetiradosClient";

export const metadata = { title: "Clientes Retirados de Internet" };

export default async function ClientesRetiradosPage() {
  const clients = await getInternetClients();
  const retired = clients.filter((c) => c.retiredAt);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Clientes retirados</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Clientes de internet que se fueron: deuda pendiente, galería, router y puerto que usaban. Para retirar a
        alguien usa el botón naranja en{" "}
        <Link href="/taller-control/cobranza-internet" className="font-semibold text-accent hover:underline">
          Cobranza de Internet
        </Link>
        .
      </p>
      <ClientesRetiradosClient clients={retired} />
    </div>
  );
}
