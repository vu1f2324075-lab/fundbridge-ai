import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { schemes } from "../../data/mockData";

function EligibilityBadge({ status }: { status: string }) {
  const cls =
    status === "Potentially Eligible"
      ? "bg-[#E8F5F0] text-[#16845B]"
      : status === "Needs Information"
      ? "bg-[#FDF3E0] text-[#C98516]"
      : "bg-[#F1F5F9] text-[#64748B]";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

export default function GovernmentSchemes() {
  const { navigate, setSelectedScheme } = useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filtered = schemes.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || s.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Government Schemes</div>
          <h1 className="text-2xl font-bold text-[#172033]">Government Funding Schemes</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Explore schemes that may match your business profile. — Sample eligibility data
          </p>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="bg-[#E8F5F0] border border-[#A7D7C2] rounded-lg px-4 py-2.5 flex items-center gap-2">
            <span className="font-bold text-[#16845B] text-lg">5</span>
            <span className="text-sm text-[#64748B]">Potentially Relevant Schemes</span>
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
              placeholder="Search schemes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] bg-[#F7F9FC]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#F7F9FC] outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Startup Support">Startup Support</option>
            <option value="MSME">MSME</option>
            <option value="Business Loan">Business Loan</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                {["Scheme", "Category", "Support", "Eligibility", "Match", "Action"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                  onClick={() => { setSelectedScheme(s.id); navigate("startup-scheme-detail"); }}
                >
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm text-[#172033]">{s.name}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">{s.administeredBy}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{s.category}</td>
                  <td className="px-5 py-4 text-sm text-[#64748B]">{s.support}</td>
                  <td className="px-5 py-4"><EligibilityBadge status={s.eligibility} /></td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.match >= 85 ? "bg-[#E8F5F0] text-[#16845B]" : "bg-[#EBF2FF] text-[#2563EB]"}`}>
                      {s.match}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedScheme(s.id); navigate("startup-scheme-detail"); }}
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

        <div className="bg-[#FDF3E0] border border-[#F5D28A] rounded-lg px-4 py-3 text-xs text-[#92600A]">
          <strong>Important:</strong> Eligibility status shown is based on prototype matching only. Always review official scheme requirements before applying.
          Match scores are sample data for demonstration purposes.
        </div>
      </div>
    </DashboardLayout>
  );
}
