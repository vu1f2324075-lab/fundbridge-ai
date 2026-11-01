import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { proposalAnalysis } from "../../data/mockData";

function ScoreBar({ name, score }: { name: string; score: number }) {
  const color = score >= 75 ? "#16845B" : score >= 65 ? "#C98516" : "#C64545";
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#172033]">{name}</span>
        <span className="text-sm font-semibold" style={{ color }}>{score}</span>
      </div>
      <div className="w-full bg-[#F1F5F9] rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ProposalAssistant() {
  const { navigate } = useApp();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Proposal Assistant</div>
          <h1 className="text-2xl font-bold text-[#172033]">Proposal Assistant</h1>
          <p className="text-sm text-[#64748B] mt-1">Review your funding proposal and identify areas for improvement.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Document preview */}
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="bg-[#F7F9FC] border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="#64748B" strokeWidth="1.3" />
                <line x1="5" y1="5" x2="11" y2="5" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="5" y1="8" x2="11" y2="8" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="5" y1="11" x2="8" y2="11" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-semibold text-[#64748B]">BuildTech_Funding_Proposal.pdf</span>
            </div>
            <div className="p-5 space-y-3">
              {["Executive Summary", "Problem Statement", "Solution Overview", "Market Opportunity", "Business Model", "Traction & Evidence", "Financial Projections", "Team & Founders", "Funding Request"].map((section) => (
                <div key={section} className="flex items-center gap-2 p-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg">
                  <div className="w-1.5 h-1.5 bg-[#CBD5E1] rounded-full" />
                  <span className="text-xs text-[#64748B]">{section}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis */}
          <div className="lg:col-span-3 space-y-5">
            {/* Overall score */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-[#172033]">Proposal Analysis</h2>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#C98516]">{proposalAnalysis.overall}</div>
                  <div className="text-xs text-[#64748B]">/ 100 · Overall Score</div>
                </div>
              </div>
              {proposalAnalysis.sections.map((s) => (
                <ScoreBar key={s.name} name={s.name} score={s.score} />
              ))}
            </div>

            {/* AI summary */}
            <div className="bg-[#EBF2FF] border border-[#BFDBFE] rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#2563EB] mb-1">AI Analysis · Prototype</div>
                  <p className="text-sm text-[#1e40af]">{proposalAnalysis.summary}</p>
                </div>
              </div>
            </div>

            {/* Improvement areas */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">Improvement Suggestions</h2>
              <div className="space-y-3">
                {proposalAnalysis.improvements.slice(0, 4).map((imp, i) => (
                  <div key={imp.area} className="flex items-start gap-3 p-3 border border-[#E2E8F0] rounded-lg">
                    <div className="w-5 h-5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#64748B]">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-[#172033] mb-0.5">{imp.area}</div>
                      <div className="text-xs text-[#64748B]">{imp.issue}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                      imp.priority === "High" ? "bg-[#FBE9E9] text-[#C64545]" : "bg-[#FDF3E0] text-[#C98516]"
                    }`}>
                      {imp.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate("startup-proposal-improvement")}
              className="w-full bg-[#173F6B] text-white text-sm font-semibold py-3 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              View Suggested Improvements →
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
