export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-fg-muted md:flex-row md:px-10">
        <p>© {new Date().getFullYear()} INFOSISTEL. Huancayo, Perú.</p>
        <p>Av. Giráldez 274 · +51 964 648 202</p>
      </div>
    </footer>
  );
}
