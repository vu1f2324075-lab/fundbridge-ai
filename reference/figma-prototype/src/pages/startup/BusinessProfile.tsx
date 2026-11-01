import DashboardLayout from "../../components/DashboardLayout";
import { demoStartup } from "../../data/mockData";

export default function BusinessProfile() {
  const sections = [
    {
      title: "Business Information",
      fields: [
        { label: "Business Name", value: demoStartup.name },
        { label: "Business Type", value: demoStartup.type },
        { label: "Industry", value: demoStartup.industry },
        { label: "Business Stage", value: demoStartup.stage },
        { label: "Location", value: demoStartup.location },
        { label: "Year Established", value: String(demoStartup.yearEstablished) },
      ],
    },
    {
      title: "Funding Requirement",
      fields: [
        { label: "Funding Required", value: demoStartup.fundingRequired },
        { label: "Funding Type", value: demoStartup.fundingType },
        { label: "Purpose", value: demoStartup.fundingPurpose },
        { label: "Preferred Source", value: demoStartup.preferredSource },
      ],
    },
    {
      title: "Financial Information",
      fields: [
        { label: "Annual Revenue", value: demoStartup.annualRevenue },
        { label: "Monthly Revenue", value: demoStartup.monthlyRevenue },
        { label: "Profitability", value: demoStartup.profitability },
        { label: "Existing Investment", value: demoStartup.existingInvestment },
      ],
    },
    {
      title: "Founder / Team",
      fields: [
        { label: "Founder Experience", value: demoStartup.founderExperience },
        { label: "Team Size", value: String(demoStartup.teamSize) },
        { label: "Registration Status", value: demoStartup.registrationStatus },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#172033]">Business Profile</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Your business information used for funding analysis.</p>
          </div>
          <div className="flex gap-2">
            <button className="text-sm font-medium text-[#64748B] border border-[#E2E8F0] px-4 py-2 rounded-lg hover:bg-[#F7F9FC]">
              Edit
            </button>
            <button className="text-sm font-semibold bg-[#173F6B] text-white px-4 py-2 rounded-lg hover:bg-[#1e4d82]">
              Save Changes
            </button>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#EBF2FF] text-[#2563EB] px-2.5 py-1 rounded-full mb-5">
          DEMO PROFILE · Sample data
        </span>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">{section.title}</h2>
              <div className="grid grid-cols-2 gap-4">
                {section.fields.map((f) => (
                  <div key={f.label}>
                    <div className="text-xs text-[#94A3B8] font-medium mb-1">{f.label}</div>
                    <div className="text-sm font-semibold text-[#172033]">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">Business Description</h2>
            <p className="text-sm text-[#64748B] leading-relaxed">{demoStartup.description}</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
