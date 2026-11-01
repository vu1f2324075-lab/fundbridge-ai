/**
 * Public landing page.
 *
 * Composition only — each section lives in components/marketing. This file also
 * RE-EXPORTS `PublicHeader` and `PublicFooter`, which Login, Register,
 * HowItWorks and NotFound all import from here. That path is part of the
 * project's internal contract and must keep working.
 *
 * The marketing surface uses the same indigo/violet palette as the signed-in
 * application, so moving from this page into the product does not feel like
 * arriving at a different product.
 *
 * Every figure shown on this page is either fetched live from the public API
 * or labelled on screen as an illustration. There are no invented metrics,
 * logos, testimonials or counts anywhere in it.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../../components/marketing/SiteChrome';
import { Hero } from '../../components/marketing/Hero';
import {
  About,
  Audiences,
  CredibilityStrip,
  Features,
  FinalCta,
  ProblemSolution,
} from '../../components/marketing/Content';
import { Faq, HowItWorks, ProductDemo } from '../../components/marketing/Interactive';
import { SchemeExplorer } from '../../components/marketing/SchemeExplorer';

export { PublicHeader, PublicFooter };

export default function Landing() {
  const { hash } = useLocation();

  // Arriving at /#schemes from another route: the element only exists after
  // this page mounts, so the browser's own hash handling has already run and
  // missed it.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PublicHeader />

      <main className="flex-1">
        <Hero />
        <CredibilityStrip />
        <ProblemSolution />
        <HowItWorks />
        <Features />
        <ProductDemo />
        <Audiences />
        <SchemeExplorer />
        <About />
        <Faq />
        <FinalCta />
      </main>

      <PublicFooter />
    </div>
  );
}
