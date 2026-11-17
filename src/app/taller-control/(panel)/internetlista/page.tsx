import { getInternetClients } from "../cobranza-internet/internetActions";
import { InternetListaClient } from "./InternetListaClient";

export const metadata = {
  title: "Internet Lista — Historial y Recibos | INFOSISTEL",
  description: "Historial de pagos de internet mes a mes, comprobantes con correlativo de 6 dígitos, envío por WhatsApp y exportación PDF.",
};

export default async function InternetListaPage() {
  const clients = await getInternetClients();

  return <InternetListaClient initialClients={clients} />;
}

