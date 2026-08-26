import { MessageCircle } from "lucide-react";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { FacebookIcon } from "@/components/icons/FacebookIcon";

const SOCIALS = [
  { Icon: MessageCircle, href: "https://wa.me/51964648202", label: "WhatsApp" },
  { Icon: FacebookIcon, href: "https://www.facebook.com/share/1CAYDHW7va/", label: "Facebook" },
  { Icon: TikTokIcon, href: "https://www.tiktok.com/@infosistel6", label: "TikTok" },
] as const;

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {SOCIALS.map(({ Icon, href, label }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-raised hover:text-accent"
        >
          <Icon size={16} strokeWidth={1.75} />
        </a>
      ))}
    </div>
  );
}
