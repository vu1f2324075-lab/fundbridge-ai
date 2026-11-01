import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches } from "../../data/mockData";

export default function DiscoverBusinesses() {
  const { navigate, setSelectedBusiness } = useApp();
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [sort, setSort] = useState("match");

  const allBusinesses = [
    ...businessMatches,
    { id: "medtech", name: "MedTech Plus", industry: "Healthcare", stage: "Early", fundingRequired: "₹25L", location: "Bangalore", match: 71, purpose: "Product Development", annualRevenue: "₹8 Lakhs", teamSize: 5, description: "AI-assisted diagnostic tools for rural clinics.", longDescription: "", matchBreakdown: [], matchReasons: [], insights: [], reviewAreas: [], proposalSections: [] },
    { id: "edulink", name: "EduLink", industry: "Education Technology", stage: "Early", fundingRequired: "₹20L", location: "Pune", match: 68, purpose: "Expansion", annualRevenue: "₹10 Lakhs", teamSize: 7, description: "Online vocational training platform for blue-collar workers.", longDescription: "", matchBreakdown: [], matchReasons: [], insights: [], reviewAreas: [], proposalSections: [] },
  ];

  const filtered = allBusinesses.filter((b) => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.industry.toLowerCase().includes(search.toLowerCase());
    const matchIndustry = industryFilter === "All" || b.industry === industryFilter;
    const matchStage = stageFilter === "All" || b.stage === stageFilter;
    return matchSearch && matchIndustry && matchStage;
  }).sort((a, b) => sort === "match" ? b.match - a.match : a.name.localeCompare(b.name));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Investor</div>
          <h1 className="text-2xl font-bold text-[#172033]">Discover Businesses</h1>
          <p className="text-sm text-[#64748B] mt-1">Search and discover businesses seeking funding.</p>
        </div>

        {/* Search + Filters */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by industry, business name or funding requirement..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] bg-[#F7F9FC]"
            />
          </div>
          <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none">
            <option value="All">All Industries</option>
            <option value="Construction Technology">Construction Technology</option>
            <option value="FinTech">FinTech</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Logistics Technology">Logistics Technology</option>
          </select>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none">
            <option value="All">All Stages</option>
            <option value="Early">Early</option>
            <option value="Growth">Growth</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none">
            <option value="match">Best Match</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((biz) => (
            <div
              key={biz.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 hover:border-[#173F6B]/30 transition-colors cursor-pointer"
              onClick={() => { setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F1F5F9] rounded-xl flex items-center justify-center text-xs font-bold text-[#64748B]">
                    {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#172033] text-sm">{biz.name}</div>
                    <div className="text-xs text-[#64748B]">{biz.industry} · {biz.stage}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  biz.match >= 85 ? "bg-[#E8F5F0] text-[#16845B]" : biz.match >= 75 ? "bg-[#EBF2FF] text-[#2563EB]" : "bg-[#F1F5F9] text-[#64748B]"
                }`}>
                  {biz.match}% Match
                </span>
              </div>
              <p className="text-xs text-[#64748B] mb-3">{biz.description}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#94A3B8]">Seeking <strong className="text-[#172033]">{biz.fundingRequired}</strong></span>
                <span className="text-[#94A3B8]">·</span>
                <span className="text-[#94A3B8]">{biz.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
