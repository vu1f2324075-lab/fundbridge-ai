/**
 * Authenticated shell — deep indigo sidebar, white topbar.
 *
 * Navigation is derived from the signed-in user's role, which comes from the
 * server. There is no role switcher: a user's role is a property of their
 * account, not a demo control. Hiding a nav item is UX, not security — every
 * route behind these links is enforced server-side by role and ownership.
 *
 * Three things here are deliberate:
 *
 *  - **Icons are drawn, not typed.** The navigation used unicode glyphs, which
 *    resolve to whatever font on the user's machine happens to contain them, so
 *    they rendered at inconsistent weights and baselines across platforms. See
 *    `components/ui/icons.tsx`.
 *  - **The chrome is one flat colour.** A large saturated gradient competes
 *    with the data for attention, which is the opposite of what dashboard
 *    chrome should do.
 *  - **The topbar names the current page.** It was previously an empty 64px
 *    strip with a user menu pushed to one end.
 */
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMeta } from '../hooks/queries';
import {
  IconActionPlan,
  IconAssistant,
  IconAudit,
  IconBusiness,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconDataQuality,
  IconDiscover,
  IconDocument,
  IconKnowledge,
  IconMatches,
  IconPreferences,
  IconReadiness,
  IconRecommend,
  IconRupee,
  IconSaved,
  IconScales,
  IconSchemes,
  IconSettings,
  IconSignOut,
  IconUsers,
  type IconProps,
} from '../components/ui/icons';
import type { Role } from '../types/api';

interface NavItem {
  label: string;
  to: string;
  Icon: ComponentType<IconProps>;
  /** Hidden when the named feature flag is false. */
  feature?: string;
}

const NAV: Record<Role, NavItem[]> = {
  STARTUP: [
    { label: 'Dashboard', to: '/app', Icon: IconDashboard },
    { label: 'Business Profile', to: '/app/profile', Icon: IconBusiness },
    { label: 'Funding Requirement', to: '/app/funding-requirement', Icon: IconRupee },
    { label: 'Funding Readiness', to: '/app/readiness', Icon: IconReadiness },
    { label: 'Government Schemes', to: '/app/schemes', Icon: IconSchemes },
    { label: 'Recommendations', to: '/app/recommendations', Icon: IconRecommend },
    { label: 'Proposals', to: '/app/proposals', Icon: IconDocument, feature: 'proposalUpload' },
    {
      label: 'Proposal Assistant',
      to: '/app/assistant',
      Icon: IconAssistant,
      feature: 'proposalAssistant',
    },
    { label: 'Action Plan', to: '/app/action-plan', Icon: IconActionPlan },
    { label: 'Saved', to: '/app/saved', Icon: IconSaved },
  ],
  INVESTOR: [
    { label: 'Dashboard', to: '/investor', Icon: IconDashboard },
    { label: 'Preferences', to: '/investor/preferences', Icon: IconPreferences },
    { label: 'Discover', to: '/investor/discover', Icon: IconDiscover },
    { label: 'Matches', to: '/investor/matches', Icon: IconMatches },
    { label: 'Shortlist', to: '/investor/shortlist', Icon: IconSaved },
  ],
  ADMIN: [
    { label: 'Overview', to: '/admin', Icon: IconDashboard },
    { label: 'Schemes', to: '/admin/schemes', Icon: IconSchemes },
    { label: 'Data Quality', to: '/admin/data-quality', Icon: IconDataQuality },
    { label: 'Knowledge Base', to: '/admin/rag', Icon: IconKnowledge },
    { label: 'Matching Config', to: '/admin/matching-config', Icon: IconScales },
    { label: 'Users', to: '/admin/users', Icon: IconUsers },
    { label: 'Audit Log', to: '/admin/audit', Icon: IconAudit },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  STARTUP: 'Startup / MSME',
  INVESTOR: 'Investor',
  ADMIN: 'Administrator',
};

const HOME: Record<Role, string> = { STARTUP: '/app', INVESTOR: '/investor', ADMIN: '/admin' };

/** Null where the role has no settings page, which hides the nav item. */
const SETTINGS_PATH: Record<Role, string | null> = {
  STARTUP: '/app/settings',
  INVESTOR: '/investor/settings',
  ADMIN: null,
};

function BridgeMark() {
  return (
    <svg width="26" height="22" viewBox="0 0 32 27" fill="none" aria-hidden="true">
      <path
        d="M2 23 L2 14 Q16 2 30 14 L30 23"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="2" y1="23" x2="30" y2="23" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="9" y1="23" x2="9" y2="15" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="23" x2="16" y2="10" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="23" x2="23" y2="15" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Detail routes that have no navigation item of their own.
 *
 * Without these a path like `/investor/businesses/<id>` matches nothing and the
 * topbar goes blank, which is honest but unhelpful.
 */
const EXTRA_LABELS: Array<{ to: string; label: string }> = [
  { to: '/investor/businesses', label: 'Business' },
];

/**
 * The name of the page currently shown, for the topbar.
 *
 * Longest matching prefix wins, so `/app/proposals/<id>` still resolves to
 * "Proposals" rather than falling through to the dashboard's `/app`.
 *
 * The role's home route is matched exactly and never by prefix. It is a prefix
 * of every other route in its section, so prefix-matching it made it the
 * fallback for anything without its own nav item — `/investor/businesses/<id>`
 * was labelled "Dashboard".
 */
function currentPageLabel(
  items: NavItem[],
  settingsPath: string | null,
  home: string,
  pathname: string,
): string {
  const candidates = [
    ...items,
    ...EXTRA_LABELS,
    ...(settingsPath ? [{ label: 'Settings', to: settingsPath }] : []),
  ];

  let best: { label: string; to: string } | null = null;
  for (const item of candidates) {
    const matches =
      item.to === home ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (matches && (!best || item.to.length > best.to.length)) best = item;
  }
  return best?.label ?? '';
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { data: meta } = useMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const role: Role = user?.role ?? 'STARTUP';
  const home = HOME[role];
  const settingsPath = SETTINGS_PATH[role];

  // A nav item for an unimplemented feature is hidden rather than shown
  // disabled: a control that cannot work should not be visible at all.
  const items = NAV[role].filter((item) => !item.feature || meta?.features?.[item.feature] !== false);

  const pageLabel = currentPageLabel(items, settingsPath, home, location.pathname);

  // Closed by a click anywhere outside it and by Escape. Relying on blur alone
  // meant the menu vanished whenever focus moved for any reason.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative w-full flex items-center gap-3 px-3 mx-2 rounded-[8px] py-2 text-small font-medium transition-colors ${
      isActive ? 'bg-white/[0.13] text-white' : 'text-white/60 hover:bg-white/[0.07] hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <aside
        className={`flex-shrink-0 flex flex-col bg-shell text-white transition-[width] duration-200 ${
          sidebarOpen ? 'w-[248px]' : 'w-[68px]'
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0">
          <div className="flex-shrink-0">
            <BridgeMark />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-[15px] tracking-tight whitespace-nowrap">
              FundBridge <span className="text-brand-glow">AI</span>
            </span>
          )}
          <button
            className="ml-auto p-1.5 rounded-[6px] text-white/55 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <IconChevronLeft size={15} /> : <IconChevronRight size={15} />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="px-5 pb-3">
            <span className="text-micro uppercase text-white/40">{ROLE_LABEL[role]}</span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-2 space-y-0.5">
          {items.map(({ label, to, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === home}
              className={navLinkClass}
              title={sidebarOpen ? undefined : label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-glow rounded-r-full"
                      aria-hidden="true"
                    />
                  )}
                  <Icon size={18} className="flex-shrink-0" />
                  {sidebarOpen && <span className="whitespace-nowrap truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}

          {/* Only the roles that actually have a settings page get the link. An
              administrator has none — /admin/settings redirects straight back to
              the overview — so rendering it produced a nav item that looked
              broken. The divider goes with it, rather than being left dangling. */}
          {settingsPath && (
            <>
              <div className="my-3 mx-4 border-t border-white/10" />
              <NavLink
                to={settingsPath}
                className={navLinkClass}
                title={sidebarOpen ? undefined : 'Settings'}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-glow rounded-r-full"
                        aria-hidden="true"
                      />
                    )}
                    <IconSettings size={18} className="flex-shrink-0" />
                    {sidebarOpen && <span>Settings</span>}
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {sidebarOpen && (
          <div className="px-5 py-4 border-t border-white/10">
            <p className="text-caption text-white/40 leading-relaxed">
              Decision support only. Not a guarantee of funding, eligibility or investment.
            </p>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 h-16 bg-surface border-b border-line flex items-center px-7 gap-4">
          {pageLabel && (
            <div className="min-w-0">
              <p className="text-micro uppercase text-ink-faint">{ROLE_LABEL[role]}</p>
              <h1 className="text-section text-ink truncate">{pageLabel}</h1>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 text-left hover:bg-canvas rounded-control px-2 py-1.5 transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="w-8 h-8 rounded-full bg-accent-deep text-white text-caption font-semibold flex items-center justify-center flex-shrink-0">
                  {initials}
                </span>
                <span className="hidden sm:block">
                  <span className="block text-small font-medium text-ink leading-tight">
                    {user?.name}
                  </span>
                  <span className="block text-caption text-ink-soft leading-tight">{user?.email}</span>
                </span>
                <IconChevronDown size={14} className="text-ink-faint" />
              </button>

              {menuOpen && (
                <div
                  className="absolute top-full right-0 mt-1.5 bg-surface border border-line rounded-card shadow-overlay py-1 z-50 min-w-[196px]"
                  role="menu"
                >
                  <div className="px-3 py-1.5 text-micro uppercase text-ink-faint">
                    {ROLE_LABEL[role]}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-small text-danger hover:bg-danger-bg transition-colors"
                    role="menuitem"
                  >
                    <IconSignOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-7 py-7">
          <div className="max-w-[1180px] mx-auto">
            <Outlet />
            {meta?.disclaimer && (
              <p className="text-caption text-ink-faint leading-relaxed mt-10 pt-5 border-t border-line">
                {meta.disclaimer}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
