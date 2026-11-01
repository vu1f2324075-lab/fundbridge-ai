import DashboardLayout from "../../components/DashboardLayout";
import { demoInvestor } from "../../data/mockData";

export default function InvestorProfile() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Investor Profile</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Your investment firm profile and information.</p>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 bg-[#EBF2FF] rounded-xl flex items-center justify-center text-xl font-bold text-[#2563EB]">AV</div>
              <div>
                <h2 className="text-xl font-bold text-[#172033]">{demoInvestor.name}</h2>
                <p className="text-sm text-[#64748B]">{demoInvestor.focus}</p>
              </div>
              <span className="ml-auto text-xs font-semibold bg-[#E8F5F0] text-[#16845B] px-2.5 py-1 rounded-full">DEMO INVESTOR</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Investment Range", value: demoInvestor.range },
                { label: "Preferred Stage", value: demoInvestor.stage },
                { label: "Location", value: demoInvestor.location },
                { label: "Investment Focus", value: demoInvestor.focus },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-xs text-[#94A3B8] mb-0.5">{f.label}</div>
                  <div className="text-sm font-semibold text-[#172033]">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Industry Focus</h2>
            <div className="flex flex-wrap gap-2">
              {demoInvestor.industries.map((ind) => (
                <span key={ind} className="text-sm bg-[#EBF2FF] text-[#2563EB] px-3 py-1.5 rounded-lg font-medium">{ind}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82]">Edit Profile</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
