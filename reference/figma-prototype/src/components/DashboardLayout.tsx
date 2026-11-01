import { useState } from "react";
import Logo from "./Logo";
import { useApp, type AppPage } from "../context/AppContext";

const startupNav = [
  { label: "Dashboard", page: "startup-dashboard" as AppPage, icon: "⊞" },
  { label: "Business Profile", page: "startup-business-profile" as AppPage, icon: "◎" },
  { label: "Funding Readiness", page: "startup-funding-readiness" as AppPage, icon: "◈" },
  { label: "Investor Matching", page: "startup-investor-matching" as AppPage, icon: "⟁" },
  { label: "Government Schemes", page: "startup-govt-schemes" as AppPage, icon: "◧" },
  { label: "Recommendations", page: "startup-recommendations" as AppPage, icon: "★" },
  { label: "Proposal Assistant", page: "startup-proposal-assistant" as AppPage, icon: "◻" },
  { label: "Saved Opportunities", page: "startup-saved" as AppPage, icon: "♡" },
];

const investorNav = [
  { label: "Investor Dashboard", page: "investor-dashboard" as AppPage, icon: "⊞" },
  { label: "Business Matches", page: "investor-business-matches" as AppPage, icon: "⟁" },
  { label: "Discover Businesses", page: "investor-discover" as AppPage, icon: "◎" },
  { label: "Saved Businesses", page: "investor-saved" as AppPage, icon: "♡" },
  { label: "Funding Preferences", page: "investor-preferences" as AppPage, icon: "◈" },
  { label: "Proposal Reviews", page: "investor-proposal-review" as AppPage, icon: "◻" },
  { label: "Notifications", page: "investor-notifications" as AppPage, icon: "◑" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, page, navigate, resetDemo } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRoleSwitch, setShowRoleSwitch] = useState(false);
  const nav = role === "investor" ? investorNav : startupNav;

  const settingsPage: AppPage = role === "investor" ? "investor-settings" : "startup-settings";
  const profilePage: AppPage = role === "investor" ? "investor-profile" : "startup-business-profile";

  return (
    <div className="flex h-screen bg-[#F7F9FC] overflow-hidden font-[Inter]">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 flex flex-col bg-[#173F6B] text-white transition-all duration-200 ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 min-h-[64px]">
          <div className="flex-shrink-0">
            <svg width="26" height="22" viewBox="0 0 32 27" fill="none">
              <path d="M2 23 L2 14 Q16 2 30 14 L30 23" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="2" y1="23" x2="30" y2="23" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="9" y1="23" x2="9" y2="15" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="23" x2="16" y2="10" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
              <line x1="23" y1="23" x2="23" y2="15" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-base tracking-tight">
              FundBridge <span className="text-[#93C5FD]">AI</span>
            </span>
          )}
          <button
            className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d={sidebarOpen ? "M10 4L6 8L10 12" : "M6 4L10 8L6 12"} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Role badge */}
        {sidebarOpen && (
          <div className="px-4 py-2">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              {role === "investor" ? "Investor View" : "Startup / MSME"}
            </span>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {nav.map((item) => {
            const active = page === item.page;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
                {active && sidebarOpen && (
                  <span className="ml-auto w-1 h-4 bg-[#2563EB] rounded-full" />
                )}
              </button>
            );
          })}

          <div className="my-3 mx-4 border-t border-white/10" />

          <button
            onClick={() => navigate(settingsPage)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/65 hover:bg-white/8 hover:text-white transition-colors"
          >
            <span className="text-base flex-shrink-0 w-5 text-center">⚙</span>
            {sidebarOpen && <span>Settings</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/65 hover:bg-white/8 hover:text-white transition-colors">
            <span className="text-base flex-shrink-0 w-5 text-center">?</span>
            {sidebarOpen && <span>Help & Support</span>}
          </button>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex-shrink-0 h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Role switcher */}
            <div className="relative">
              <button
                onClick={() => setShowRoleSwitch(!showRoleSwitch)}
                className="flex items-center gap-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />
                {role === "investor" ? "Investor" : "Startup / MSME"}
                <span className="text-[#94A3B8]">▾</span>
              </button>
              {showRoleSwitch && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Switch Role</div>
                  <button
                    onClick={() => {
                      navigate("startup-dashboard");
                      setShowRoleSwitch(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F7F9FC] text-[#172033]"
                  >
                    Startup / MSME
                  </button>
                  <button
                    onClick={() => {
                      navigate("investor-dashboard");
                      setShowRoleSwitch(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F7F9FC] text-[#172033]"
                  >
                    Investor
                  </button>
                  <div className="border-t border-[#E2E8F0] my-1" />
                  <button
                    onClick={() => { resetDemo(); setShowRoleSwitch(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[#C64545] hover:bg-[#FBE9E9]"
                  >
                    Reset Demo
                  </button>
                </div>
              )}
            </div>

            {/* Notification */}
            <button className="relative p-2 rounded-lg hover:bg-[#F7F9FC] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14a1 1 0 0 0 2 0H6a1 1 0 0 0 2 0zM13 10V7A5 5 0 0 0 3 7v3l-1 1v1h12v-1l-1-1z" stroke="#64748B" strokeWidth="1.3" fill="none" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#C64545] rounded-full" />
            </button>

            {/* Avatar */}
            <button
              onClick={() => navigate(profilePage)}
              className="w-8 h-8 rounded-full bg-[#173F6B] text-white text-xs font-semibold flex items-center justify-center"
            >
              {role === "investor" ? "AV" : "RS"}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
