import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches, demoInvestor } from "../../data/mockData";

function KPICard({ title, value, sub, color }: { title: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
      <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{title}</div>
      <div className="text-3xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-xs text-[#64748B]">{sub}</div>
    </div>
  );
}

function InsightBadge({ status }: { status: string }) {
  const cls =
    status === "Strong" ? "bg-[#E8F5F0] text-[#16845B]" :
    status === "Good" ? "bg-[#EBF2FF] text-[#2563EB]" :
    "bg-[#FDF3E0] text-[#C98516]";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

export default function InvestorDashboard() {
  const { navigate, setSelectedBusiness } = useApp();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Good morning, Alpha Ventures</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Discover businesses aligned with your investment preferences.</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold bg-[#E8F5F0] text-[#16845B] px-2.5 py-1 rounded-full">DEMO INVESTOR</span>
          <span className="text-xs text-[#64748B]">Alpha Ventures · Technology & Construction Technology · ₹25L – ₹1Cr · Sample data</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard title="Potential Matches" value={demoInvestor.totalMatches} sub="Business Matches" color="#173F6B" />
          <KPICard title="High Match" value={demoInvestor.highMatch} sub="Above 85% Match" color="#16845B" />
          <KPICard title="Saved Businesses" value={demoInvestor.saved} sub="In Your Shortlist" color="#2563EB" />
          <KPICard title="Pending Reviews" value={demoInvestor.pendingReviews} sub="Proposals to Review" color="#C98516" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top matches */}
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[#172033]">Top Business Matches</h2>
              <button onClick={() => navigate("investor-business-matches")} className="text-xs text-[#2563EB] font-medium hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {businessMatches.map((biz) => (
                <div
                  key={biz.id}
                  className="flex items-center gap-4 p-4 border border-[#E2E8F0] rounded-xl hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                  onClick={() => { setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
                >
                  <div className="w-10 h-10 bg-[#F1F5F9] rounded-xl flex items-center justify-center text-xs font-bold text-[#64748B] flex-shrink-0">
                    {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#172033]">{biz.name}</div>
                    <div className="text-xs text-[#64748B]">{biz.industry} · {biz.stage} · {biz.location}</div>
                    <div className="text-xs text-[#94A3B8]">Seeking {biz.fundingRequired}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      biz.match >= 90 ? "bg-[#E8F5F0] text-[#16845B]" :
                      biz.match >= 85 ? "bg-[#EBF2FF] text-[#2563EB]" :
                      "bg-[#F1F5F9] text-[#64748B]"
                    }`}>
                      {biz.match}% Match
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
                      className="text-xs font-semibold text-[#173F6B] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#EBF2FF]"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Investment preferences */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#172033] text-sm">Investment Preferences</h3>
                <button onClick={() => navigate("investor-preferences")} className="text-xs text-[#2563EB] hover:underline">Edit</button>
              </div>
              <div className="space-y-2 text-xs">
                <div><span className="text-[#94A3B8]">Range: </span><span className="font-medium text-[#172033]">{demoInvestor.range}</span></div>
                <div><span className="text-[#94A3B8]">Stage: </span><span className="font-medium text-[#172033]">{demoInvestor.stage}</span></div>
                <div><span className="text-[#94A3B8]">Location: </span><span className="font-medium text-[#172033]">{demoInvestor.location}</span></div>
                <div className="pt-1">
                  <span className="text-[#94A3B8]">Industries: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {demoInvestor.industries.slice(0, 3).map((ind) => (
                      <span key={ind} className="text-[10px] bg-[#EBF2FF] text-[#2563EB] px-2 py-0.5 rounded">{ind}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <h3 className="font-semibold text-[#172033] text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: "Business Matches", page: "investor-business-matches" },
                  { label: "Discover Businesses", page: "investor-discover" },
                  { label: "Proposal Reviews", page: "investor-proposal-review" },
                  { label: "Notifications", page: "investor-notifications" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.page as any)}
                    className="w-full text-left text-xs font-medium text-[#64748B] px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F7F9FC] hover:text-[#172033] transition-colors"
                  >
                    {item.label} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
