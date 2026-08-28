"use client";

import { usePathname } from "next/navigation";
import ChatBot from "@/components/ChatBotLazy";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

/**
 * The marketing Navbar/Footer/chat widget wrap every page from the root
 * layout — except /taller-control, which is an internal tool with its own topbar
 * (see admin/(panel)/layout.tsx) and has no business showing a WhatsApp
 * chat bubble or "Iniciar sesión" link to someone already logged into it.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/taller-control");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <ChatBot />
    </>
  );
}
