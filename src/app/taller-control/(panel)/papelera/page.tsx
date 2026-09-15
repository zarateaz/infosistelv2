import { Trash2 } from "lucide-react";
import { getDeletedSales } from "../ventas/actions";
import { DeletedSaleRow } from "./DeletedSaleRow";

export default async function AdminTrashPage() {
  const sales = await getDeletedSales();

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-fg">
        <Trash2 size={22} className="text-accent" /> Papelera
      </h1>
      <p className="mt-1 text-sm text-fg-muted">
        {sales.length} venta{sales.length === 1 ? "" : "s"} eliminada{sales.length === 1 ? "" : "s"} · restaura una para
        que vuelva a Ventas, con su fecha original intacta.
      </p>

      <div className="mt-8 overflow-x-auto admin-glass rounded-[var(--radius-lg)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="admin-thead text-xs font-bold uppercase tracking-wider text-fg-muted">
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Cantidad</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Fecha de la venta</th>
              <th className="px-5 py-3">Eliminada el</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <DeletedSaleRow key={s.id} sale={s} />
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-fg-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Trash2 size={28} className="text-fg-muted/50" />
                    <p className="font-semibold">La papelera está vacía.</p>
                    <p className="text-xs">Las ventas que elimines desde Ventas aparecerán aquí.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
