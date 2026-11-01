import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors } from "../../data/mockData";

function MatchBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#172033]">{label}</span>
        <span className="text-sm font-bold text-[#16845B]">{score}%</span>
      </div>
      <div className="w-full bg-[#F1F5F9] rounded-full h-2">
        <div className="h-2 rounded-full bg-[#16845B]" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function InvestorDetail() {
  const { selectedInvestorId, navigate, savedInvestors, toggleSavedInvestor } = useApp();
  const inv = investors.find((i) => i.id === selectedInvestorId) ?? investors[0];
  const isSaved = savedInvestors.includes(inv.id);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-5">
          <button onClick={() => navigate("startup-investor-matching")} className="hover:text-[#173F6B]">
            Investor Matching
          </button>
          <span>/</span>
          <span className="text-[#172033] font-medium">{inv.name}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Investor profile */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <div className="w-14 h-14 bg-[#EBF2FF] rounded-xl flex items-center justify-center mb-4 text-lg font-bold text-[#2563EB]">
                {inv.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <h1 className="text-xl font-bold text-[#172033] mb-1">{inv.name}</h1>
              <p className="text-sm text-[#64748B] mb-5">{inv.description}</p>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">Investment Range</span>
                  <span className="font-semibold text-[#172033]">{inv.range}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">Preferred Stage</span>
                  <span className="font-semibold text-[#172033]">{inv.stage}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">Location</span>
                  <span className="font-semibold text-[#172033]">{inv.location}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">Industry Focus</span>
                  <div className="flex flex-wrap gap-1">
                    {inv.focus.map((f) => (
                      <span key={f} className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">Portfolio</span>
                  <div className="flex flex-wrap gap-1">
                    {inv.portfolio.map((p) => (
                      <span key={p} className="text-[10px] bg-[#EBF2FF] text-[#2563EB] px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => toggleSavedInvestor(inv.id)}
                className={`w-full text-sm font-semibold py-2.5 rounded-lg border transition-colors ${
                  isSaved
                    ? "bg-[#E8F5F0] border-[#A7D7C2] text-[#16845B]"
                    : "bg-[#173F6B] border-[#173F6B] text-white hover:bg-[#1e4d82]"
                }`}
              >
                {isSaved ? "✓ Investor Saved" : "Save Investor"}
              </button>
              <button
                onClick={() => navigate("startup-recommendations")}
                className="w-full text-sm font-medium py-2.5 rounded-lg border border-[#E2E8F0] text-[#172033] hover:bg-[#F7F9FC] transition-colors"
              >
                View All Matches
              </button>
            </div>
          </div>

          {/* Right: Match analysis */}
          <div className="lg:col-span-2 space-y-5">
            {/* Match score */}
            <div className="bg-[#173F6B] rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
                    FundBridge Match Analysis · Sample Score
                  </div>
                  <h2 className="text-xl font-bold">Match Score</h2>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">{inv.match}%</div>
                  <div className="text-sm text-white/60">Potential Match</div>
                </div>
              </div>
            </div>

            {/* Match breakdown */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-5">Match Score Breakdown</h2>
              {inv.breakdown.map((b) => (
                <MatchBar key={b.factor} label={b.factor} score={b.score} />
              ))}
            </div>

            {/* WHY THIS MATCH — the key explainability section */}
            <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
                <h2 className="font-bold text-[#172033] text-lg">WHY THIS MATCH?</h2>
              </div>
              <p className="text-sm text-[#64748B] mb-5">
                These factors from your business profile align with this investor's stated preferences.
              </p>
              <div className="space-y-3 mb-5">
                {inv.reasons.map((r) => (
                  <div key={r} className="flex items-start gap-3 p-3 bg-[#E8F5F0] border border-[#A7D7C2] rounded-lg">
                    <div className="w-5 h-5 bg-[#16845B] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="text-sm font-medium text-[#172033]">{r}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg px-4 py-3">
                <p className="text-xs text-[#64748B]">
                  <strong>Note:</strong> Recommendations are based on the information available in your business profile
                  and publicly stated investor preferences. These are potential matches only — conduct your own
                  due diligence before approaching investors. This is a prototype demonstration.
                </p>
              </div>
            </div>

            {/* How matching works */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">How Matching Works</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {["Investor Preference", "Business Profile", "Funding Requirement", "Industry", "Business Stage", "Location"].map((item, i) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-1.5 rounded-lg font-medium text-[#172033]">
                      {item}
                    </span>
                    {i < 5 && <span className="text-[#94A3B8]">+</span>}
                  </div>
                ))}
                <span className="text-[#94A3B8]">→</span>
                <div className="bg-[#173F6B] text-white px-3 py-1.5 rounded-lg font-semibold">
                  {inv.match}% Match
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
