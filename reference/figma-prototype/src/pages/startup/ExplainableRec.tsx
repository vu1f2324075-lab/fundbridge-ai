import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors } from "../../data/mockData";

export default function ExplainableRec() {
  const { navigate, setSelectedInvestor } = useApp();
  const inv = investors[0];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Explainable AI</div>
          <h1 className="text-2xl font-bold text-[#172033]">Why These Recommendations?</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Understand the factors influencing your funding recommendations.
          </p>
        </div>

        {/* Featured investor explanation */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#EBF2FF] rounded-xl flex items-center justify-center text-xs font-bold text-[#2563EB]">AV</div>
              <div>
                <div className="font-bold text-[#172033]">{inv.name}</div>
                <div className="text-xs text-[#64748B]">Investor · Technology Focus</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#16845B]">{inv.match}%</div>
              <div className="text-xs text-[#94A3B8]">Sample Match Score</div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {inv.breakdown.map((b) => (
              <div key={b.factor}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[#172033]">{b.factor}</span>
                  <span className="text-sm font-bold text-[#16845B]">{b.score}%</span>
                </div>
                <div className="w-full bg-[#F1F5F9] rounded-full h-2">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#16845B] to-[#22c55e]" style={{ width: `${b.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E2E8F0] pt-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
              <h3 className="font-bold text-[#172033]">Key Matching Factors</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {inv.reasons.map((r) => (
                <div key={r} className="flex items-start gap-2 p-3 bg-[#E8F5F0] rounded-lg">
                  <span className="text-[#16845B] font-bold text-sm mt-0.5">✓</span>
                  <span className="text-sm text-[#172033]">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Matching factors diagram */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mb-5">
          <h2 className="font-semibold text-[#172033] mb-4">How the Match Score is Calculated</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {["Your Business Profile", "Investor Preferences", "Funding Requirement"].map((item) => (
              <div key={item} className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg p-3 text-center text-xs font-medium text-[#172033]">
                {item}
              </div>
            ))}
          </div>
          <div className="flex justify-center mb-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-0.5 h-5 bg-[#CBD5E1]" />
              <div className="bg-[#173F6B] text-white px-4 py-2 rounded-lg text-sm font-semibold">
                FundBridge Matching
              </div>
              <div className="w-0.5 h-5 bg-[#CBD5E1]" />
            </div>
          </div>
          <div className="flex justify-center">
            <div className="bg-[#E8F5F0] border border-[#A7D7C2] rounded-xl px-8 py-4 text-center">
              <div className="text-3xl font-bold text-[#16845B]">{inv.match}% Match</div>
              <div className="text-xs text-[#64748B] mt-1">Sample Match Score</div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-sm text-[#64748B]">
            <strong className="text-[#172033]">About These Recommendations:</strong> Recommendations are based on the information
            available in your business profile and the matching criteria used by the system. Match scores are sample data
            for this prototype demonstration and do not represent actual investment assessments or guaranteed outcomes.
            Always conduct your own due diligence.
          </p>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => { setSelectedInvestor("alpha-ventures"); navigate("startup-investor-detail"); }}
            className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
          >
            View Alpha Ventures →
          </button>
          <button
            onClick={() => navigate("startup-recommendations")}
            className="border border-[#E2E8F0] text-[#172033] text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
          >
            All Recommendations
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
