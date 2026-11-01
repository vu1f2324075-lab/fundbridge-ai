/**
 * Sign-in portals.
 *
 * There is one portal per role — business owner, investor, administrator — plus
 * a chooser at /login. They are presentation only: all three post to the same
 * `POST /api/auth/login`, and the server decides everything that matters.
 *
 * TWO RULES MAKE SEPARATE PORTALS SAFE
 * ------------------------------------
 * A per-role sign-in page is an obvious place to leak which accounts hold which
 * role, so both of these are deliberate and must not be "improved" later:
 *
 *   1. Every portal shows the same failure text, taken verbatim from the server,
 *      which returns one indistinguishable message for a wrong password and an
 *      unknown email. A portal must never say "that is not an administrator
 *      account" — that would turn this page into an oracle for probing which
 *      addresses are privileged.
 *
 *   2. On success the user goes to the home of the role their ACCOUNT holds, not
 *      the role of the portal they used. Signing in through the administrator
 *      portal with a business account lands on the business dashboard, silently.
 *      No error, nothing disclosed, and nothing gained by guessing.
 *
 * Form validation mirrors the backend's login schema deliberately loosely: any
 * non-empty password is accepted here, because the server must be free to accept
 * a credential created under an older policy. Tightening it client-side would
 * lock out a legitimate user and leak the current policy.
 */
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { FieldError } from '../../components/ui';
import { PublicHeader, PublicFooter } from './Landing';
import type { Role } from '../../types/api';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

const HOME: Record<Role, string> = { STARTUP: '/app', INVESTOR: '/investor', ADMIN: '/admin' };

interface Portal {
  /** The role this portal is presented for. Not an authorisation claim. */
  role: Role;
  path: string;
  label: string;
  title: string;
  subtitle: string;
  /** Who this portal is for, on the chooser card. */
  audience: string;
  accent: string;
  accentHover: string;
  tint: string;
  border: string;
  icon: ReactNode;
  /** Role to preselect on the registration form; absent where there is no self-signup. */
  registerRole?: 'STARTUP' | 'INVESTOR';
  /** What this role can see, stated on the portal itself. */
  scopeNote: string;
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 17V6l6-3v14M9 17h8V9l-8-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 11h2M12 14h2M5.5 8.5h1M5.5 11.5h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconGrowth() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 14.5l4.5-4.5 3 3L17 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6H17v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5l6 2.2v5.1c0 3.4-2.4 6.4-6 7.7-3.6-1.3-6-4.3-6-7.7V4.7l6-2.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 10l1.8 1.8L13 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PORTALS: Record<'business' | 'investor' | 'admin', Portal> = {
  business: {
    role: 'STARTUP',
    path: '/login/business',
    label: 'Business owner',
    title: 'Business owner sign-in',
    subtitle: 'Assess your funding readiness and find schemes you may be eligible for.',
    audience: 'Startups and MSMEs looking for funding.',
    accent: '#4F46E5',
    accentHover: '#4338CA',
    tint: '#EEF0FF',
    border: '#C7CCFF',
    icon: <IconBuilding />,
    registerRole: 'STARTUP',
    scopeNote: 'Your business information, proposals and financial figures stay private to your account.',
  },
  investor: {
    role: 'INVESTOR',
    path: '/login/investor',
    label: 'Investor',
    title: 'Investor sign-in',
    subtitle: 'Discover businesses that match the investment preferences you have stated.',
    audience: 'Angels, funds and firms deploying capital.',
    accent: '#0F766E',
    accentHover: '#0C5F58',
    tint: '#ECFAF7',
    border: '#B5E3DB',
    icon: <IconGrowth />,
    registerRole: 'INVESTOR',
    scopeNote:
      'You see only businesses that opted into discovery, and only what they chose to share — revenue as a band, never exact figures, and no proposals.',
  },
  admin: {
    role: 'ADMIN',
    path: '/login/admin',
    label: 'Administrator',
    title: 'Administrator sign-in',
    subtitle: 'Verify scheme records, manage accounts and review the audit log.',
    audience: 'Platform operators and data curators.',
    accent: '#BE185D',
    accentHover: '#9D174D',
    tint: '#FCE7F3',
    border: '#FBCFE8',
    icon: <IconShield />,
    // No registerRole: administrators are provisioned, never self-registered.
    // A self-service admin signup would be a privilege-escalation hole.
    scopeNote:
      'Administrator accounts are provisioned directly and cannot be self-registered. Every privileged action is written to the audit log.',
  },
};

function PortalForm({ portal }: { portal: Portal }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);

      // The ACCOUNT's role decides the destination, never this portal's. See the
      // file header: a mismatch must be silent, because an error here would
      // disclose which role an address holds.
      const home = HOME[user.role];
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        // Shown verbatim. The server returns one indistinguishable message for a
        // wrong password and an unknown email; do not substitute anything more
        // specific here, on any portal.
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="bg-white border border-line rounded-[10px] p-6 shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border"
                style={{ color: portal.accent, backgroundColor: portal.tint, borderColor: portal.border }}
              >
                {portal.icon}
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: portal.accent }}
              >
                {portal.label}
              </span>
            </div>

            <h1 className="text-lg font-semibold text-ink tracking-tight mt-3">{portal.title}</h1>
            <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">{portal.subtitle}</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none transition-colors focus:border-[color:var(--portal-accent)]"
                  style={{ ['--portal-accent' as string]: portal.accent }}
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError message={errors.email?.message} />
              </div>

              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none transition-colors focus:border-[color:var(--portal-accent)]"
                  style={{ ['--portal-accent' as string]: portal.accent }}
                  aria-invalid={Boolean(errors.password)}
                />
                <FieldError message={errors.password?.message} />
              </div>

              {formError && (
                <div className="bg-danger-bg border border-danger/30 rounded-lg px-3 py-2" role="alert">
                  <p className="text-[13px] text-ink">{formError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg transition-colors bg-[color:var(--portal-accent)] hover:bg-[color:var(--portal-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  ['--portal-accent' as string]: portal.accent,
                  ['--portal-accent-hover' as string]: portal.accentHover,
                }}
              >
                {isSubmitting && (
                  <span
                    className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                )}
                Sign in
              </button>
            </form>
          </div>

          {portal.registerRole && (
            <p className="text-[13px] text-ink-soft text-center mt-4">
              No account?{' '}
              <Link
                to={`/register?role=${portal.registerRole}`}
                className="font-medium hover:underline"
                style={{ color: portal.accent }}
              >
                Create one
              </Link>
            </p>
          )}

          <p className="text-[13px] text-center mt-4">
            <Link to="/login" className="text-ink-soft hover:text-ink hover:underline">
              Sign in as someone else
            </Link>
          </p>

          <p className="text-[11px] text-ink-faint text-center mt-6 leading-relaxed">{portal.scopeNote}</p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export function BusinessLogin() {
  return <PortalForm portal={PORTALS.business} />;
}

export function InvestorLogin() {
  return <PortalForm portal={PORTALS.investor} />;
}

export function AdminLogin() {
  return <PortalForm portal={PORTALS.admin} />;
}

/**
 * The chooser at /login.
 *
 * Listing the administrator portal here discloses nothing: that the platform
 * has administrators is already evident, and the portal itself reveals nothing
 * about which accounts are privileged.
 */
export default function LoginChooser() {
  const order: Array<keyof typeof PORTALS> = ['business', 'investor', 'admin'];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-lg font-semibold text-ink tracking-tight text-center">Sign in</h1>
          <p className="text-[13px] text-ink-soft mt-1 text-center">Choose how you use FundBridge.</p>

          <div className="mt-6 space-y-3">
            {order.map((key) => {
              const p = PORTALS[key];
              return (
                <Link
                  key={key}
                  to={p.path}
                  className="group block bg-white border border-line rounded-[10px] p-4 shadow-[0_1px_2px_rgba(23,32,51,0.04)] transition-colors hover:border-[color:var(--portal-accent)]"
                  style={{ ['--portal-accent' as string]: p.accent }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border flex-shrink-0"
                      style={{ color: p.accent, backgroundColor: p.tint, borderColor: p.border }}
                    >
                      {p.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{p.label}</p>
                      <p className="text-[12px] text-ink-soft mt-0.5 leading-relaxed">{p.audience}</p>
                    </div>
                    <span
                      className="ml-auto text-line-strong transition-colors self-center"
                      style={{ color: undefined }}
                      aria-hidden="true"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M6 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="text-[13px] text-ink-soft text-center mt-5">
            No account?{' '}
            <Link to="/register" className="text-accent font-medium hover:underline">
              Create one
            </Link>
          </p>

          <p className="text-[11px] text-ink-faint text-center mt-6 leading-relaxed">
            Your session is held in a secure, server-only cookie. Whichever portal you use, your account's own role
            decides what you can reach, and that is enforced on the server.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
