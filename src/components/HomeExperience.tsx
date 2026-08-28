"use client";

import { SmoothScroll } from "@/components/scroll/SmoothScroll";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { ContactCta } from "@/components/sections/ContactCta";

export function HomeExperience({ storeShowcase }: { storeShowcase: React.ReactNode }) {
  return (
    <SmoothScroll>
      <main>
        <Hero />
        {storeShowcase}
        <Services />
        <ContactCta />
      </main>
    </SmoothScroll>
  );
}
