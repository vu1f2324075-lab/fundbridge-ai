import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches } from "../../data/mockData";

export default function BusinessMatches() {
  const { navigate, setSelectedBusiness } = useApp();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  const filtered = businessMatches.filter((b) => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.industry.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "All" || b.stage === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Investor · Business Matching</div>
          <h1 className="text-2xl font-bold text-[#172033]">Business Matches</h1>
          <p className="text-sm text-[#64748B] mt-1">Businesses matching your investment preferences. — Sample Match Scores</p>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="bg-[#EBF2FF] border border-[#BFDBFE] rounded-lg px-4 py-2.5 flex items-center gap-2">
            <span className="font-bold text-[#173F6B] text-lg">18</span>
            <span className="text-sm text-[#64748B]">Potential Business Matches</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search businesses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] bg-[#F7F9FC]"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none"
          >
            <option value="All">All Stages</option>
            <option value="Early">Early</option>
            <option value="Growth">Growth</option>
          </select>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                {["Business", "Industry", "Stage", "Funding Required", "Location", "Match", "Action"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((biz) => (
                <tr
                  key={biz.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC] cursor-pointer transition-colors"
                  onClick={() => { setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#F1F5F9] rounded-lg flex items-center justify-center text-xs font-bold text-[#64748B]">
                        {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[#172033]">{biz.name}</div>
                        <div className="text-xs text-[#64748B]">{biz.purpose}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{biz.industry}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{biz.stage}</td>
                  <td className="px-5 py-4 text-sm font-medium text-[#172033]">{biz.fundingRequired}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{biz.location}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      biz.match >= 90 ? "bg-[#E8F5F0] text-[#16845B]" :
                      biz.match >= 85 ? "bg-[#EBF2FF] text-[#2563EB]" :
                      "bg-[#F1F5F9] text-[#64748B]"
                    }`}>
                      {biz.match}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
                      className="text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-3 py-1.5 rounded-lg hover:bg-[#EBF2FF] transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
