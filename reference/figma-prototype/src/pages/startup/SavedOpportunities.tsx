import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors, schemes } from "../../data/mockData";

export default function SavedOpportunities() {
  const { savedInvestors, savedSchemes, toggleSavedInvestor, toggleSavedScheme, navigate, setSelectedInvestor, setSelectedScheme } = useApp();
  const [tab, setTab] = useState<"investors" | "schemes">("investors");

  const savedInvData = investors.filter((i) => savedInvestors.includes(i.id));
  const savedSchemeData = schemes.filter((s) => savedSchemes.includes(s.id));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Saved Opportunities</h1>
          <p className="text-sm text-[#64748B] mt-1">Opportunities you have saved for later review.</p>
        </div>

        <div className="flex bg-[#F1F5F9] rounded-lg p-1 gap-1 w-fit mb-5">
          {(["investors", "schemes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                tab === t ? "bg-white text-[#172033] shadow-sm" : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              {t === "investors" ? `Investors (${savedInvData.length})` : `Gov. Schemes (${savedSchemeData.length})`}
            </button>
          ))}
        </div>

        {tab === "investors" && (
          savedInvData.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
              <div className="text-[#94A3B8] text-sm mb-3">No investors saved yet</div>
              <button
                onClick={() => navigate("startup-investor-matching")}
                className="text-sm font-semibold text-[#173F6B] border border-[#173F6B] px-4 py-2 rounded-lg hover:bg-[#EBF2FF]"
              >
                Browse Investors
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                    {["Opportunity", "Type", "Range", "Match", "Action"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedInvData.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC]">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-sm text-[#172033]">{inv.name}</div>
                        <div className="text-xs text-[#64748B]">{inv.stage}</div>
                      </td>
                      <td className="px-5 py-4"><span className="text-xs bg-[#EBF2FF] text-[#2563EB] px-2 py-0.5 rounded font-semibold">Investor</span></td>
                      <td className="px-5 py-4 text-sm text-[#64748B]">{inv.range}</td>
                      <td className="px-5 py-4"><span className="text-sm font-bold text-[#16845B]">{inv.match}%</span></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => { setSelectedInvestor(inv.id); navigate("startup-investor-detail"); }} className="text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-2 py-1 rounded hover:bg-[#EBF2FF]">View</button>
                          <button onClick={() => toggleSavedInvestor(inv.id)} className="text-xs text-[#C64545] border border-[#FCA5A5] px-2 py-1 rounded hover:bg-[#FBE9E9]">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "schemes" && (
          savedSchemeData.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
              <div className="text-[#94A3B8] text-sm mb-3">No schemes saved yet</div>
              <button
                onClick={() => navigate("startup-govt-schemes")}
                className="text-sm font-semibold text-[#173F6B] border border-[#173F6B] px-4 py-2 rounded-lg hover:bg-[#EBF2FF]"
              >
                Browse Schemes
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
                    {["Scheme", "Category", "Support", "Match", "Action"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedSchemeData.map((s) => (
                    <tr key={s.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7F9FC]">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-sm text-[#172033]">{s.name}</div>
                        <div className="text-xs text-[#64748B]">{s.administeredBy}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#64748B]">{s.category}</td>
                      <td className="px-5 py-4 text-sm text-[#64748B]">{s.support}</td>
                      <td className="px-5 py-4"><span className="text-sm font-bold text-[#C98516]">{s.match}%</span></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => { setSelectedScheme(s.id); navigate("startup-scheme-detail"); }} className="text-xs font-semibold text-[#173F6B] border border-[#173F6B] px-2 py-1 rounded hover:bg-[#EBF2FF]">View</button>
                          <button onClick={() => toggleSavedScheme(s.id)} className="text-xs text-[#C64545] border border-[#FCA5A5] px-2 py-1 rounded hover:bg-[#FBE9E9]">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
