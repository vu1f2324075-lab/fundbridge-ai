import DashboardLayout from "../../components/DashboardLayout";

export default function InvestorSettings() {
  const sections = [
    {
      title: "Profile",
      items: [
        { label: "Firm Name", value: "Alpha Ventures" },
        { label: "Contact Email", value: "invest@alphavcs.example.com" },
        { label: "Phone", value: "+91 98888 77777" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "New high-match businesses", type: "toggle", value: true },
        { label: "Proposal updates", type: "toggle", value: true },
        { label: "Business profile changes", type: "toggle", value: false },
        { label: "Weekly digest", type: "toggle", value: true },
      ],
    },
    {
      title: "Preferences",
      items: [
        { label: "Currency", value: "INR (₹)" },
        { label: "Timezone", value: "IST (UTC+5:30)" },
        { label: "Language", value: "English" },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Settings</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Manage your investor account settings.</p>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4 pb-3 border-b border-[#F1F5F9]">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#172033]">{item.label}</span>
                    {"type" in item && item.type === "toggle" ? (
                      <button className={`w-10 h-5 rounded-full transition-colors relative ${item.value ? "bg-[#173F6B]" : "bg-[#E2E8F0]"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${item.value ? "left-5" : "left-0.5"}`} />
                      </button>
                    ) : (
                      <span className="text-sm text-[#64748B]">{String(item.value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
