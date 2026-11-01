import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors, schemes, readinessScores } from "../../data/mockData";

function KPICard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
      <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{title}</div>
      <div className={`text-3xl font-bold mb-1`} style={{ color }}>{value}</div>
      <div className="text-xs text-[#64748B]">{sub}</div>
    </div>
  );
}

function ProgressBar({ pct, color = "#173F6B" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function Dashboard() {
  const { navigate, setSelectedInvestor, setSelectedScheme } = useApp();
  const topInvestors = investors.slice(0, 3);
  const topSchemes = schemes.slice(0, 2);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Good morning, Rahul</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Here is your current funding overview for BuildTech Solutions.</p>
        </div>

        {/* Demo badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold bg-[#EBF2FF] text-[#2563EB] px-2.5 py-1 rounded-full">DEMO PROFILE</span>
          <span className="text-xs text-[#64748B]">BuildTech Solutions · Construction Technology · Mumbai · Sample data</span>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard title="Funding Readiness" value="78 / 100" sub="Good" color="#173F6B" />
          <KPICard title="Investor Matches" value="8" sub="Potential Matches" color="#2563EB" />
          <KPICard title="Government Schemes" value="5" sub="Relevant Schemes" color="#C98516" />
          <KPICard title="Proposal Score" value="72 / 100" sub="Needs Improvement" color="#C98516" />
        </div>

        {/* Main two-col */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Funding Readiness */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-[#172033] mb-0.5">Funding Readiness</h2>
                <p className="text-xs text-[#64748B]">Score based on your business profile</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#173F6B]">78</div>
                <div className="text-xs text-[#64748B]">/ 100</div>
              </div>
            </div>
            <div className="space-y-4">
              {readinessScores.breakdown.map((item) => (
                <div key={item.area}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#172033]">{item.area}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#172033]">{item.score}%</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.status === "Strong"
                            ? "bg-[#E8F5F0] text-[#16845B]"
                            : item.status === "Good"
                            ? "bg-[#EBF2FF] text-[#2563EB]"
                            : "bg-[#FDF3E0] text-[#C98516]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <ProgressBar pct={item.score} color={item.status === "Improve" ? "#C98516" : "#173F6B"} />
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("startup-funding-readiness")}
              className="mt-5 w-full text-sm font-medium text-[#173F6B] border border-[#173F6B] py-2 rounded-lg hover:bg-[#F7F9FC] transition-colors"
            >
              View Full Report
            </button>
          </div>

          {/* Top Opportunities */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[#172033]">Top Funding Opportunities</h2>
              <button onClick={() => navigate("startup-recommendations")} className="text-xs text-[#2563EB] font-medium hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {topInvestors.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F7F9FC] transition-colors">
                  <div className="w-8 h-8 bg-[#EBF2FF] rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#2563EB]">
                    {inv.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[#172033] truncate">{inv.name}</div>
                    <div className="text-xs text-[#64748B]">{inv.stage} · {inv.range}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-[#16845B] bg-[#E8F5F0] px-2 py-0.5 rounded-full">
                      {inv.match}%
                    </span>
                    <button
                      onClick={() => { setSelectedInvestor(inv.id); navigate("startup-investor-detail"); }}
                      className="text-xs font-medium text-[#173F6B] border border-[#E2E8F0] px-2 py-1 rounded-lg hover:bg-[#EBF2FF] transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Government Schemes</div>
              {topSchemes.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] mb-2 hover:bg-[#F7F9FC] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[#172033] truncate">{s.name}</div>
                    <div className="text-xs text-[#64748B]">{s.support}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-[#C98516] bg-[#FDF3E0] px-2 py-0.5 rounded-full">
                      {s.match}%
                    </span>
                    <button
                      onClick={() => { setSelectedScheme(s.id); navigate("startup-scheme-detail"); }}
                      className="text-xs font-medium text-[#173F6B] border border-[#E2E8F0] px-2 py-1 rounded-lg hover:bg-[#EBF2FF] transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
          <h2 className="font-semibold text-[#172033] mb-4">Recommended Actions</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { title: "Complete financial projections", desc: "Add 12–24 month projections to strengthen your profile.", action: "startup-proposal-assistant", color: "#C98516", bg: "#FDF3E0" },
              { title: "Improve proposal clarity", desc: "Clarify how requested funding will be used.", action: "startup-proposal-assistant", color: "#2563EB", bg: "#EBF2FF" },
              { title: "Review investor requirements", desc: "Check Alpha Ventures investment criteria.", action: "startup-investor-matching", color: "#173F6B", bg: "#EBF2FF" },
            ].map((a) => (
              <div key={a.title} className="rounded-lg border border-[#E2E8F0] p-4">
                <div className="w-2 h-2 rounded-full mb-3" style={{ background: a.color }} />
                <div className="font-medium text-sm text-[#172033] mb-1">{a.title}</div>
                <div className="text-xs text-[#64748B] mb-3">{a.desc}</div>
                <button
                  onClick={() => navigate(a.action as any)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: a.bg, color: a.color }}
                >
                  Take Action →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
