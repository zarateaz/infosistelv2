import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

// Sits directly above the AI ChatBot bubble (same 56px size, same right-6
// offset, one slot higher at bottom-24) so a visitor can go straight to a
// human on WhatsApp instead of spending tokens on the AI assistant for
// anything more than a quick catalog/hours question.
export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/51964648202"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-105 active:scale-95"
    >
      <WhatsAppIcon size={24} />
    </a>
  );
}
