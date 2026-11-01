import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { demoInvestor } from "../../data/mockData";

export default function FundingPreferences() {
  const [saved, setSaved] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Funding Preferences</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Define your investment preferences to improve business matching accuracy.</p>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Investment Range</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1.5">Minimum Investment</label>
                <input defaultValue="₹25 Lakhs" className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1.5">Maximum Investment</label>
                <input defaultValue="₹1 Crore" className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB]" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Preferred Industries</h2>
            <div className="flex flex-wrap gap-2">
              {["Technology", "Construction Technology", "SaaS", "Enterprise Software", "FinTech", "Healthcare", "Logistics", "Manufacturing", "Agriculture"].map((ind) => {
                const isSelected = demoInvestor.industries.includes(ind);
                return (
                  <button
                    key={ind}
                    className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      isSelected
                        ? "bg-[#EBF2FF] border-[#2563EB] text-[#2563EB]"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    {ind}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Preferred Business Stage</h2>
            <div className="flex gap-3 flex-wrap">
              {["Idea", "Early", "Growth", "Established"].map((stage) => {
                const isSelected = demoInvestor.stages.includes(stage);
                return (
                  <button
                    key={stage}
                    className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${
                      isSelected
                        ? "bg-[#173F6B] border-[#173F6B] text-white"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Preferred Locations</h2>
            <div className="flex flex-wrap gap-2">
              {["Mumbai", "Pune", "Bangalore", "Delhi", "Hyderabad", "Chennai", "Pan-India"].map((loc) => {
                const isSelected = demoInvestor.locations.includes(loc);
                return (
                  <button
                    key={loc}
                    className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      isSelected
                        ? "bg-[#E8F5F0] border-[#16845B] text-[#16845B]"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setSaved(true)}
              className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              {saved ? "✓ Preferences Saved" : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
