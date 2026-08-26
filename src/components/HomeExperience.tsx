"use client";

import { useCallback, useState } from "react";
import { Preloader } from "@/components/preloader/Preloader";
import { SmoothScroll } from "@/components/scroll/SmoothScroll";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
        <Navbar />
        <main>
          <Hero play={preloaderDone} />
          <Services />
          <Stats />
          <ContactCta />
        </main>
        <Footer />
      </SmoothScroll>
    </>
  );
}
