"use client";

import { useCallback, useState } from "react";
import { Preloader } from "@/components/preloader/Preloader";
import { SmoothScroll } from "@/components/scroll/SmoothScroll";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { Stats } from "@/components/sections/Stats";
import { ContactCta } from "@/components/sections/ContactCta";

export function HomeExperience() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const handlePreloaderComplete = useCallback(() => setPreloaderDone(true), []);

  return (
    <>
      <Preloader onComplete={handlePreloaderComplete} />
      <SmoothScroll>
        <main>
          <Hero play={preloaderDone} />
          <Services />
          <Stats />
          <ContactCta />
        </main>
      </SmoothScroll>
    </>
  );
}
