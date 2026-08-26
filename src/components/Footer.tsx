import { SocialLinks } from "@/components/SocialLinks";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 md:flex-row md:px-10">
        <p className="text-xs text-fg-muted">© {new Date().getFullYear()} INFOSISTEL. Huancayo, Perú.</p>
        <SocialLinks />
        <p className="text-xs text-fg-muted">Av. Giráldez 274 · +51 964 648 202</p>
      </div>
    </footer>
  );
}
