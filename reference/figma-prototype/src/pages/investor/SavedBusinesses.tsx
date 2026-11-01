import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches } from "../../data/mockData";

export default function SavedBusinesses() {
  const { shortlistedBusinesses, toggleShortlisted, navigate, setSelectedBusiness } = useApp();
  const saved = businessMatches.filter((b) => shortlistedBusinesses.includes(b.id));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Saved Businesses</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Businesses you have shortlisted or saved.</p>
        </div>

        {saved.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
            <div className="text-[#94A3B8] text-sm mb-3">No businesses saved yet.</div>
            <button
              onClick={() => navigate("investor-business-matches")}
              className="text-sm font-semibold text-[#173F6B] border border-[#173F6B] px-4 py-2 rounded-lg hover:bg-[#EBF2FF]"
            >
              Browse Business Matches
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                  {["Business", "Match", "Funding Required", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saved.map((biz) => (
                  <tr key={biz.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-[#172033]">{biz.name}</div>
                      <div className="text-xs text-[#64748B]">{biz.industry} · {biz.stage}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[#16845B]">{biz.match}%</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#172033] font-medium">{biz.fundingRequired}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold bg-[#E8F5F0] text-[#16845B] px-2 py-0.5 rounded">Shortlisted</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedBusiness(biz.id); navigate("investor-business-detail"); }}
                          className="text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-2 py-1 rounded hover:bg-[#EBF2FF]"
                        >
                          View
                        </button>
                        <button
                          onClick={() => toggleShortlisted(biz.id)}
                          className="text-xs text-[#C64545] border border-[#FCA5A5] px-2 py-1 rounded hover:bg-[#FBE9E9]"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
