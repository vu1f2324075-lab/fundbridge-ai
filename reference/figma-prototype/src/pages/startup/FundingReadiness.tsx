import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { readinessScores } from "../../data/mockData";

function ProgressBar({ pct, color = "#173F6B" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function FundingReadiness() {
  const { navigate } = useApp();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Funding Readiness</div>
          <h1 className="text-2xl font-bold text-[#172033]">Funding Readiness Assessment</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Understand how prepared your business is before approaching funding sources.
          </p>
        </div>

        {/* Score card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 mb-6 flex items-center gap-8">
          <div className="flex-shrink-0 text-center">
            <div className="w-28 h-28 rounded-full border-4 border-[#173F6B] flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#173F6B]">78</span>
              <span className="text-xs text-[#64748B]">/ 100</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-[#172033] mb-1">Good Funding Readiness</div>
            <p className="text-sm text-[#64748B] mb-3">
              Your business profile is generally well-prepared. Improving financial projections and proposal
              clarity will strengthen your funding position.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#C98516] rounded-full" />
              <span className="text-xs text-[#C98516] font-medium">3 areas need attention</span>
            </div>
          </div>
        </div>

        {/* Assessment table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 className="font-semibold text-[#172033]">Assessment Breakdown</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Area</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-left w-48">Progress</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {readinessScores.breakdown.map((row) => (
                <tr key={row.area} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[#172033]">{row.area}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#172033]">{row.score}%</td>
                  <td className="px-6 py-4 w-48">
                    <ProgressBar pct={row.score} color={row.status === "Improve" ? "#C98516" : row.status === "Strong" ? "#16845B" : "#173F6B"} />
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        row.status === "Strong"
                          ? "bg-[#E8F5F0] text-[#16845B]"
                          : row.status === "Good"
                          ? "bg-[#EBF2FF] text-[#2563EB]"
                          : "bg-[#FDF3E0] text-[#C98516]"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Areas needing attention */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-[#172033] mb-4">Areas Requiring Attention</h2>
          <div className="space-y-4">
            {readinessScores.attentionAreas.map((a) => (
              <div key={a.title} className="flex gap-4 p-4 bg-[#FDF3E0] border border-[#F5D28A] rounded-lg">
                <div className="w-5 h-5 rounded-full bg-[#C98516] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <div>
                  <div className="font-semibold text-sm text-[#172033] mb-0.5">{a.title}</div>
                  <div className="text-xs text-[#92600A]">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate("startup-proposal-assistant")}
            className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
          >
            Improve Proposal
          </button>
          <button
            onClick={() => navigate("startup-investor-matching")}
            className="border border-[#E2E8F0] text-[#172033] text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
          >
            View Investor Matches
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
