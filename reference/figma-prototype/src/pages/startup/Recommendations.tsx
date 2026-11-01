import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors, schemes } from "../../data/mockData";

export default function Recommendations() {
  const { navigate, setSelectedInvestor, setSelectedScheme } = useApp();
  const [tab, setTab] = useState<"all" | "investors" | "schemes">("all");
  const [sort, setSort] = useState("match");

  const allItems = [
    ...investors.map((i) => ({ ...i, type: "Investor" as const, reason: i.reasons[0] })),
    ...schemes.map((s) => ({ ...s, type: "Scheme" as const, reason: s.reasons[0] })),
  ].sort((a, b) => (sort === "match" ? b.match - a.match : 0));

  const displayed = tab === "all" ? allItems : tab === "investors" ? allItems.filter((i) => i.type === "Investor") : allItems.filter((i) => i.type === "Scheme");

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Recommendations</div>
          <h1 className="text-2xl font-bold text-[#172033]">Recommended Funding Opportunities</h1>
          <p className="text-sm text-[#64748B] mt-1">All matches based on your BuildTech Solutions profile · Sample data</p>
        </div>

        {/* Tab + Sort */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex bg-[#F1F5F9] rounded-lg p-1 gap-1">
            {(["all", "investors", "schemes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  tab === t ? "bg-white text-[#172033] shadow-sm" : "text-[#64748B] hover:text-[#172033]"
                }`}
              >
                {t === "all" ? "All" : t === "investors" ? "Investors" : "Gov. Schemes"}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white outline-none"
          >
            <option value="match">Best Match</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div className="space-y-3">
          {displayed.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex items-center gap-4 hover:border-[#173F6B]/30 transition-colors cursor-pointer"
              onClick={() => {
                if (item.type === "Investor") { setSelectedInvestor(item.id); navigate("startup-investor-detail"); }
                else { setSelectedScheme(item.id); navigate("startup-scheme-detail"); }
              }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                item.type === "Investor" ? "bg-[#EBF2FF] text-[#2563EB]" : "bg-[#E8F5F0] text-[#16845B]"
              }`}>
                {item.type === "Investor" ? item.name.split(" ").map((w) => w[0]).join("").slice(0,2) : "GOV"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[#172033] text-sm">{item.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    item.type === "Investor" ? "bg-[#EBF2FF] text-[#2563EB]" : "bg-[#E8F5F0] text-[#16845B]"
                  }`}>
                    {item.type}
                  </span>
                </div>
                <div className="text-xs text-[#64748B] truncate">{item.reason}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-base font-bold mb-0.5 ${item.match >= 85 ? "text-[#16845B]" : item.match >= 75 ? "text-[#2563EB]" : "text-[#64748B]"}`}>
                  {item.match}%
                </div>
                <div className="text-xs text-[#94A3B8]">Match</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.type === "Investor") { setSelectedInvestor(item.id); navigate("startup-investor-detail"); }
                  else { setSelectedScheme(item.id); navigate("startup-scheme-detail"); }
                }}
                className="flex-shrink-0 text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-3 py-1.5 rounded-lg hover:bg-[#EBF2FF] transition-colors"
              >
                View
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("startup-explainable")}
            className="text-sm font-semibold text-[#173F6B] border border-[#173F6B] px-6 py-2.5 rounded-lg hover:bg-[#EBF2FF] transition-colors"
          >
            Why These Recommendations? →
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
