"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdminTransaction } from "./actions";

export function CajaChart({ transactions }: { transactions: AdminTransaction[] }) {
  const points = useMemo(() => {
    return transactions.reduce<{ date: string; balance: number }[]>((acc, t) => {
      const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
      const balance = previousBalance + (t.type === "INCOME" ? t.amount : -t.amount);
      acc.push({ date: new Date(t.date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }), balance });
      return acc;
    }, []);
  }, [transactions]);

  if (points.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-fg-muted">
        Registra movimientos para ver la evolución del saldo.
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" stroke="#56607a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#56607a" fontSize={11} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            formatter={(value) => [`S/. ${Number(value).toFixed(2)}`, "Saldo"]}
            contentStyle={{ borderRadius: 12, border: "1px solid rgba(11,18,48,0.08)", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="balance" stroke="#0a5fdb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
