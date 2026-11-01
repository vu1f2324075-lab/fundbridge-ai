import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors } from "../../data/mockData";

export default function InvestorMatching() {
  const { navigate, setSelectedInvestor } = useApp();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");

  const filtered = investors.filter((inv) => {
    const matchSearch =
      !search || inv.name.toLowerCase().includes(search.toLowerCase()) || inv.industry.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "All" || inv.stage.includes(stageFilter);
    const matchLocation = locationFilter === "All" || inv.location === locationFilter;
    return matchSearch && matchStage && matchLocation;
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Investor Matching</div>
          <h1 className="text-2xl font-bold text-[#172033]">Investor Matching</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Potential investors based on your business profile and funding requirement. — Sample Match Scores
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-5">
          <div className="bg-[#EBF2FF] border border-[#BFDBFE] rounded-lg px-4 py-2.5 flex items-center gap-2">
            <span className="font-bold text-[#173F6B] text-lg">8</span>
            <span className="text-sm text-[#64748B]">Potential Investor Matches</span>
          </div>
          <span className="text-xs text-[#94A3B8]">Based on BuildTech Solutions profile · Prototype data</span>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search investors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] transition-colors bg-[#F7F9FC]"
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
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none"
          >
            <option value="All">All Locations</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Bangalore">Bangalore</option>
            <option value="India">Pan-India</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                {["Investor", "Industry", "Stage", "Investment Range", "Location", "Match", "Action"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                  onClick={() => { setSelectedInvestor(inv.id); navigate("startup-investor-detail"); }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#EBF2FF] rounded-lg flex items-center justify-center text-xs font-bold text-[#2563EB] flex-shrink-0">
                        {inv.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[#172033]">{inv.name}</div>
                        <div className="text-xs text-[#64748B] truncate max-w-[150px]">{inv.description.substring(0, 40)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{inv.industry}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{inv.stage}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B] font-medium">{inv.range}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{inv.location}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        inv.match >= 85
                          ? "bg-[#E8F5F0] text-[#16845B]"
                          : inv.match >= 75
                          ? "bg-[#EBF2FF] text-[#2563EB]"
                          : "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {inv.match}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedInvestor(inv.id); navigate("startup-investor-detail"); }}
                      className="text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-3 py-1.5 rounded-lg hover:bg-[#EBF2FF] transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-[#94A3B8]">No investors match the current filters.</div>
          )}
        </div>

        <p className="text-xs text-[#94A3B8] mt-4 text-center">
          Match scores are sample data for this prototype. Not actual investment assessments.
        </p>
      </div>
    </DashboardLayout>
  );
}
