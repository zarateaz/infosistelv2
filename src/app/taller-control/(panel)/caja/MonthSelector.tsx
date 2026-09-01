"use client";

/** Plain GET-form select that navigates to ?month=... on change — kept as
 *  its own client component only because a <select onChange> can't live
 *  directly in the server-rendered page.tsx. */
export function MonthSelector({ month, availableMonths }: { month: string; availableMonths: string[] }) {
  return (
    <form action="/taller-control/caja" method="get">
      <select
        name="month"
        defaultValue={month}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-full border border-border-strong bg-bg px-4 py-1.5 text-xs font-bold text-fg outline-none focus:border-accent"
      >
        {availableMonths.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </form>
  );
}
