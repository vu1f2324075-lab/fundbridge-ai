import Logo from "../components/Logo";
import { useApp } from "../context/AppContext";

export default function DemoRoleSelect() {
  const { navigate, setRole } = useApp();

  const startStartupDemo = () => {
    setRole("startup");
    navigate("startup-onboarding");
  };

  const startInvestorDemo = () => {
    setRole("investor");
    navigate("investor-dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col font-[Inter]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 h-16 flex items-center">
        <button onClick={() => navigate("landing")}>
          <Logo size="md" />
        </button>
        <span className="ml-4 text-xs font-semibold bg-[#2563EB] text-white px-2.5 py-1 rounded-full">
          DEMO MODE
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-[#172033] mb-2">Choose Demo Role</h1>
            <p className="text-[#64748B] text-sm">
              Select a role to explore the full FundBridge AI prototype workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Startup Demo */}
            <button
              onClick={startStartupDemo}
              className="group text-left bg-white border-2 border-[#E2E8F0] hover:border-[#173F6B] rounded-2xl p-8 transition-all hover:shadow-md"
            >
              <div className="w-12 h-12 bg-[#EBF2FF] rounded-xl flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="2" y="10" width="18" height="10" rx="2" stroke="#2563EB" strokeWidth="1.8" />
                  <path d="M7 10V7a4 4 0 0 1 8 0v3" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="11" cy="15" r="1.5" fill="#2563EB" />
                </svg>
              </div>
              <div className="font-bold text-[#172033] text-lg mb-1">Startup / MSME</div>
              <div className="text-[#64748B] text-sm mb-5 leading-relaxed">
                Experience the full startup workflow — from business profile to funding action plan with investor and scheme matching.
              </div>

              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-4 mb-5">
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Demo Profile</div>
                <div className="font-semibold text-[#172033] text-sm">BuildTech Solutions</div>
                <div className="text-xs text-[#64748B]">Construction Technology · Growth · Mumbai</div>
                <div className="text-xs text-[#64748B]">Funding Required: ₹50 Lakhs</div>
              </div>

              <div className="text-xs text-[#64748B] mb-4 space-y-1">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Funding Readiness Score</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Investor Matching with Explanations</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Government Scheme Discovery</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Proposal Analysis & Improvement</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Funding Action Plan</div>
              </div>

              <div className="w-full bg-[#173F6B] text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center group-hover:bg-[#1e4d82] transition-colors">
                Start Startup Demo →
              </div>
            </button>

            {/* Investor Demo */}
            <button
              onClick={startInvestorDemo}
              className="group text-left bg-white border-2 border-[#E2E8F0] hover:border-[#173F6B] rounded-2xl p-8 transition-all hover:shadow-md"
            >
              <div className="w-12 h-12 bg-[#E8F5F0] rounded-xl flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <circle cx="9" cy="8" r="3.5" stroke="#16845B" strokeWidth="1.8" />
                  <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" stroke="#16845B" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M16 5l2 2-4 4" stroke="#16845B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="font-bold text-[#172033] text-lg mb-1">Investor</div>
              <div className="text-[#64748B] text-sm mb-5 leading-relaxed">
                Experience the investor workflow — discover matched businesses, review profiles, understand match reasoning and shortlist opportunities.
              </div>

              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-4 mb-5">
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Demo Investor</div>
                <div className="font-semibold text-[#172033] text-sm">Alpha Ventures</div>
                <div className="text-xs text-[#64748B]">Technology & Construction Tech</div>
                <div className="text-xs text-[#64748B]">Investment: ₹25L – ₹1Cr · Mumbai</div>
              </div>

              <div className="text-xs text-[#64748B] mb-4 space-y-1">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Business Match Discovery</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Match Reasoning & Explanations</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Business Profile & Insights</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Proposal Review</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#16845B] rounded-full" />Shortlist & Save</div>
              </div>

              <div className="w-full bg-[#16845B] text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center group-hover:bg-[#126b4a] transition-colors">
                Start Investor Demo →
              </div>
            </button>
          </div>

          <div className="mt-8 bg-[#FDF3E0] border border-[#F5D28A] rounded-xl p-4 text-center">
            <p className="text-[#92600A] text-xs">
              <strong>Prototype Notice:</strong> All data shown (match scores, business profiles, investor details) is sample data for demonstration purposes only.
              Results labelled "AI Analysis" are simulated for this prototype and do not represent actual predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
