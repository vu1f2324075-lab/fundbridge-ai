import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { schemes } from "../../data/mockData";

export default function SchemeDetail() {
  const { selectedSchemeId, navigate, savedSchemes, toggleSavedScheme } = useApp();
  const s = schemes.find((x) => x.id === selectedSchemeId) ?? schemes[0];
  const isSaved = savedSchemes.includes(s.id);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-5">
          <button onClick={() => navigate("startup-govt-schemes")} className="hover:text-[#173F6B]">
            Government Schemes
          </button>
          <span>/</span>
          <span className="text-[#172033] font-medium">{s.name}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">{s.category}</div>
              <h1 className="text-xl font-bold text-[#172033] mb-3">{s.name}</h1>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-[#94A3B8] mb-0.5">Support Amount</div>
                  <div className="text-sm font-semibold text-[#172033]">{s.supportAmount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#94A3B8] mb-0.5">Support Type</div>
                  <div className="text-sm font-semibold text-[#172033]">{s.support}</div>
                </div>
                <div>
                  <div className="text-xs text-[#94A3B8] mb-0.5">Administered By</div>
                  <div className="text-sm font-semibold text-[#172033]">{s.administeredBy}</div>
                </div>
                <div>
                  <div className="text-xs text-[#94A3B8] mb-0.5">Application Window</div>
                  <div className="text-sm font-semibold text-[#172033]">{s.deadline}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => toggleSavedScheme(s.id)}
                className={`w-full text-sm font-semibold py-2.5 rounded-lg border transition-colors ${
                  isSaved
                    ? "bg-[#E8F5F0] border-[#A7D7C2] text-[#16845B]"
                    : "bg-[#173F6B] border-[#173F6B] text-white hover:bg-[#1e4d82]"
                }`}
              >
                {isSaved ? "✓ Scheme Saved" : "Save Scheme"}
              </button>
              <button
                onClick={() => navigate("startup-govt-schemes")}
                className="w-full text-sm font-medium py-2.5 rounded-lg border border-[#E2E8F0] text-[#172033] hover:bg-[#F7F9FC] transition-colors"
              >
                View All Schemes
              </button>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-2 space-y-5">
            {/* Overview */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-3">Overview</h2>
              <p className="text-sm text-[#64748B] leading-relaxed">{s.overview}</p>
            </div>

            {/* Eligibility check */}
            <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-[#172033] text-lg">Your Eligibility Check</h2>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    s.eligibility === "Potentially Eligible"
                      ? "bg-[#E8F5F0] text-[#16845B]"
                      : "bg-[#FDF3E0] text-[#C98516]"
                  }`}
                >
                  {s.eligibility}
                </span>
              </div>
              <div className="space-y-3 mb-5">
                {s.eligibilityChecks.map((c) => (
                  <div
                    key={c.text}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      c.status === "pass"
                        ? "bg-[#E8F5F0] border-[#A7D7C2]"
                        : "bg-[#FDF3E0] border-[#F5D28A]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        c.status === "pass" ? "bg-[#16845B]" : "bg-[#C98516]"
                      }`}
                    >
                      <span className="text-white text-xs font-bold">{c.status === "pass" ? "✓" : "!"}</span>
                    </div>
                    <span className="text-sm font-medium text-[#172033]">{c.text}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg px-4 py-3">
                <p className="text-xs text-[#64748B]">
                  <strong>Important:</strong> Review official scheme requirements and consult the administering body before applying.
                  This eligibility check is based on prototype matching only.
                </p>
              </div>
            </div>

            {/* Why this scheme */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">Why This Scheme?</h2>
              <div className="space-y-2">
                {s.reasons.map((r) => (
                  <div key={r} className="flex items-start gap-2 text-sm">
                    <span className="text-[#2563EB] mt-0.5">→</span>
                    <span className="text-[#64748B]">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Required documents */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">Typically Required Documents</h2>
              <div className="grid grid-cols-2 gap-2">
                {s.documents.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-sm text-[#64748B]">
                    <div className="w-1.5 h-1.5 bg-[#CBD5E1] rounded-full flex-shrink-0" />
                    {d}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#94A3B8] mt-4">
                Document requirements may vary. Verify with the official scheme portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
