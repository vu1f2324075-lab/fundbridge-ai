import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investorNotifications } from "../../data/mockData";

export default function Notifications() {
  const { navigate, setSelectedBusiness } = useApp();

  const iconMap: Record<string, string> = {
    match: "⟁",
    proposal: "◻",
    update: "◎",
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Notifications</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Updates on business matches and proposals.</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {investorNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start gap-4 px-6 py-4 border-b border-[#F1F5F9] last:border-0 cursor-pointer hover:bg-[#F7F9FC] transition-colors ${!notif.read ? "bg-[#EBF2FF]/30" : ""}`}
              onClick={() => {
                if (notif.type === "match" || notif.type === "proposal") {
                  setSelectedBusiness("buildtech");
                  navigate("investor-business-detail");
                }
              }}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                notif.type === "match" ? "bg-[#EBF2FF] text-[#2563EB]" :
                notif.type === "proposal" ? "bg-[#E8F5F0] text-[#16845B]" :
                "bg-[#F1F5F9] text-[#64748B]"
              }`}>
                {iconMap[notif.type]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-[#172033]">{notif.title}</span>
                  {!notif.read && <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full flex-shrink-0" />}
                </div>
                <div className="text-sm text-[#64748B]">{notif.body}</div>
                <div className="text-xs text-[#94A3B8] mt-1">{notif.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
