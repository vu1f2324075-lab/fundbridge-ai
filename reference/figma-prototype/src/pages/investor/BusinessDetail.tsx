import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches } from "../../data/mockData";

function InsightBadge({ status }: { status: string }) {
  const cls =
    status === "Strong" ? "bg-[#E8F5F0] text-[#16845B]" :
    status === "Good" ? "bg-[#EBF2FF] text-[#2563EB]" :
    "bg-[#FDF3E0] text-[#C98516]";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

export default function BusinessDetail() {
  const { selectedBusinessId, navigate, shortlistedBusinesses, toggleShortlisted } = useApp();
  const biz = businessMatches.find((b) => b.id === selectedBusinessId) ?? businessMatches[0];
  const isSaved = shortlistedBusinesses.includes(biz.id);
  const [showToast, setShowToast] = useState(false);

  const handleShortlist = () => {
    toggleShortlisted(biz.id);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto relative">
        {showToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#172033] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
            {isSaved ? "Business added to your shortlist." : "Business removed from shortlist."}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-5">
          <button onClick={() => navigate("investor-business-matches")} className="hover:text-[#173F6B]">Business Matches</button>
          <span>/</span>
          <span className="text-[#172033] font-medium">{biz.name}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left profile */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <div className="w-12 h-12 bg-[#F1F5F9] rounded-xl flex items-center justify-center text-sm font-bold text-[#64748B] mb-4">
                {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <h1 className="text-xl font-bold text-[#172033] mb-1">{biz.name}</h1>
              <p className="text-sm text-[#64748B] mb-4">{biz.description}</p>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: "Industry", value: biz.industry },
                  { label: "Stage", value: biz.stage },
                  { label: "Location", value: biz.location },
                  { label: "Funding Required", value: biz.fundingRequired },
                  { label: "Purpose", value: biz.purpose },
                  { label: "Annual Revenue", value: biz.annualRevenue },
                  { label: "Team Size", value: String(biz.teamSize) },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-2">
                    <span className="text-[#94A3B8] w-24 flex-shrink-0 text-xs">{f.label}</span>
                    <span className="font-semibold text-[#172033] text-xs">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleShortlist}
                className={`w-full text-sm font-semibold py-2.5 rounded-lg border transition-colors ${
                  isSaved ? "bg-[#E8F5F0] border-[#A7D7C2] text-[#16845B]" : "bg-[#173F6B] border-[#173F6B] text-white hover:bg-[#1e4d82]"
                }`}
              >
                {isSaved ? "✓ Shortlisted" : "Shortlist Business"}
              </button>
              <button
                onClick={() => navigate("investor-proposal-review")}
                className="w-full text-sm font-semibold bg-[#2563EB] text-white py-2.5 rounded-lg hover:bg-[#1d52c8] transition-colors"
              >
                Review Proposal
              </button>
              <button
                onClick={() => navigate("investor-saved")}
                className="w-full text-sm font-medium py-2.5 rounded-lg border border-[#E2E8F0] text-[#172033] hover:bg-[#F7F9FC] transition-colors"
              >
                Save Business
              </button>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-2 space-y-5">
            {/* Match score */}
            <div className="bg-[#173F6B] rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">FundBridge Match Analysis · Sample Score</div>
                  <h2 className="text-xl font-bold">Match Score</h2>
                  <p className="text-sm text-white/70 mt-1">Based on your investment preferences</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold">{biz.match}%</div>
                  <div className="text-white/60 text-xs">Potential Match</div>
                </div>
              </div>
            </div>

            {/* Match breakdown */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-5">Match Score Breakdown</h2>
              {biz.matchBreakdown.map((b) => (
                <div key={b.factor} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#172033]">{b.factor}</span>
                    <span className="text-sm font-bold text-[#16845B]">{b.score}%</span>
                  </div>
                  <div className="w-full bg-[#F1F5F9] rounded-full h-2">
                    <div className="h-2 rounded-full bg-[#16845B]" style={{ width: `${b.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* WHY THIS BUSINESS */}
            <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
                <h2 className="font-bold text-[#172033] text-lg">WHY THIS BUSINESS MATCHES YOU</h2>
              </div>
              <p className="text-sm text-[#64748B] mb-4">These factors from this business profile align with your stated investment preferences.</p>
              <div className="space-y-2 mb-5">
                {biz.matchReasons.map((r) => (
                  <div key={r} className="flex items-start gap-3 p-3 bg-[#E8F5F0] border border-[#A7D7C2] rounded-lg">
                    <div className="w-5 h-5 bg-[#16845B] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="text-sm font-medium text-[#172033]">{r}</span>
                  </div>
                ))}
              </div>

              {/* How matching works diagram */}
              <div className="border-t border-[#E2E8F0] pt-4">
                <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">How This Match Was Calculated</div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {["Investor Preference", "Business Profile", "Funding Requirement", "Industry", "Business Stage", "Location"].map((item, i) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1.5 rounded-lg font-medium text-[#172033]">{item}</span>
                      {i < 5 && <span className="text-[#94A3B8]">+</span>}
                    </div>
                  ))}
                  <span className="text-[#94A3B8]">→</span>
                  <span className="bg-[#173F6B] text-white px-3 py-1.5 rounded-lg font-semibold">{biz.match}% Match</span>
                </div>
              </div>
            </div>

            {/* Business Insights */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">Business Insights</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {biz.insights.map((ins) => (
                  <div key={ins.area} className="flex items-center justify-between p-3 border border-[#E2E8F0] rounded-lg">
                    <span className="text-sm text-[#172033]">{ins.area}</span>
                    <InsightBadge status={ins.status} />
                  </div>
                ))}
              </div>
              <div className="border-t border-[#F1F5F9] pt-4">
                <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Areas to Review</div>
                <div className="space-y-1">
                  {biz.reviewAreas.map((area) => (
                    <div key={area} className="flex items-center gap-2 text-sm text-[#64748B]">
                      <span className="text-[#C98516]">→</span>
                      {area}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
