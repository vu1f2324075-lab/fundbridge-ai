/**
 * Public site header and footer.
 *
 * These are re-exported from pages/public/Landing as `PublicHeader` and
 * `PublicFooter`, because Login, Register, HowItWorks and NotFound all import
 * them from there. That import path must keep working.
 *
 * The nav mixes two kinds of destination and they behave differently:
 *   - section anchors (#features, #schemes) scroll within the landing page,
 *     and when the visitor is on another route they navigate home first
 *   - real routes (/login, /register) are plain links
 *
 * Every link points at a route that exists. Nothing here invents a destination.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon, btn } from './primitives';

interface NavItem {
  label: string;
  /** A landing-page section id, or a router path when it starts with "/". */
  target: string;
}

const NAV: NavItem[] = [
  { label: 'Home', target: '#top' },
  { label: 'How It Works', target: '#how-it-works' },
  { label: 'Features', target: '#features' },
  { label: 'For Businesses', target: '#for-businesses' },
  { label: 'For Investors', target: '#for-investors' },
  { label: 'Government Schemes', target: '#schemes' },
  { label: 'About', target: '#about' },
];

export function BrandMark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-[10px] ${
          onDark ? 'bg-accent' : 'bg-accent-deep'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 16.5V12a9 9 0 0 1 18 0v4.5"
            stroke={onDark ? '#EEF0FF' : '#A5B4FC'}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path d="M3 16.5h18" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" />
          <path
            d="M7.5 16.5v-3.2M12 16.5v-5M16.5 16.5v-3.2"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={`text-[15px] font-semibold tracking-[-0.01em] ${
          onDark ? 'text-white' : 'text-ink'
        }`}
      >
        FundBridge{' '}
        {/* The accent is too dark on the deep band; the light step clears 4.98:1. */}
        <span className={onDark ? 'text-brand-glow' : 'text-accent'}>AI</span>
      </span>
    </span>
  );
}

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const onLanding = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile menu, and the body is locked while it is open so
  // the page behind does not scroll under the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (target: string) => {
    setOpen(false);
    if (target.startsWith('/')) {
      navigate(target);
      return;
    }
    const id = target.slice(1);
    if (!onLanding) {
      // Off the landing page, go home and let the browser resolve the hash.
      navigate(id === 'top' ? '/' : `/#${id}`);
      return;
    }
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 motion-reduce:transition-none ${
        scrolled
          ? 'bg-canvas/90 backdrop-blur-md border-b border-line shadow-[0_1px_12px_rgba(22,16,51,0.05)]'
          : 'bg-canvas border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="FundBridge AI, home"
        >
          <BrandMark />
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.target)}
              className="px-3 py-2 text-[13px] text-ink-soft rounded-lg transition-colors hover:text-ink hover:bg-muted-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden sm:flex items-center gap-2.5">
          <Link
            to="/login"
            className="px-3 py-2 text-[13px] font-medium text-ink rounded-lg transition-colors hover:bg-muted-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign In
          </Link>
          <Link to="/register" className={btn.primarySm}>
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-ink hover:bg-muted-bg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {open ? Icon.close({ size: 22 }) : Icon.menu({ size: 22 })}
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="lg:hidden border-t border-line bg-canvas max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          <nav className="px-5 py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item.target)}
                className="w-full text-left px-3 py-3 text-[15px] text-ink-soft rounded-lg hover:bg-muted-bg hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.label}
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-line grid gap-2.5 pb-2">
              <Link to="/login" onClick={() => setOpen(false)} className={btn.secondary}>
                Sign In
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className={btn.primary}>
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-accent-deep text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <BrandMark onDark />
            <p className="text-[13px] text-brand-glow leading-relaxed mt-4 max-w-xs">
              An explainable funding decision-support and matching platform for micro and small
              enterprises. Every score it shows can be traced to the inputs and weights that
              produced it.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: 'How it works', to: '/how-it-works' },
              { label: 'Features', to: '/#features' },
              { label: 'Government schemes', to: '/#schemes' },
              { label: 'About', to: '/#about' },
            ]}
          />
          <FooterCol
            title="Business owners"
            links={[
              { label: 'Create an account', to: '/register?role=STARTUP' },
              { label: 'Business sign-in', to: '/login/business' },
            ]}
          />
          <FooterCol
            title="Investors"
            links={[
              { label: 'Create an account', to: '/register?role=INVESTOR' },
              { label: 'Investor sign-in', to: '/login/investor' },
            ]}
          />
        </div>

        {/* No address, email, partner or legal page is listed: none of those
            exist for this project, and inventing them would be a fabrication. */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[12px] text-brand-glow">
            &copy; {year} FundBridge AI. A final-year academic project.
          </p>
          <p className="text-[12px] text-brand-glow max-w-xl sm:text-right">
            Decision support and discovery only. Not a guarantee of funding, eligibility, approval
            or investment. Verify scheme terms with the official source before applying.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-glow">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-[13px] text-line-accent hover:text-white transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-glow"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
