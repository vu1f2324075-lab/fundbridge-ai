import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { businessMatches } from "../../data/mockData";

function SectionBadge({ status }: { status: string }) {
  const cls =
    status === "Strong" ? "bg-[#E8F5F0] text-[#16845B]" :
    status === "Good" ? "bg-[#EBF2FF] text-[#2563EB]" :
    "bg-[#FDF3E0] text-[#C98516]";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

export default function ProposalReview() {
  const { selectedBusinessId, navigate } = useApp();
  const biz = businessMatches.find((b) => b.id === selectedBusinessId) ?? businessMatches[0];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-5">
          <button onClick={() => navigate("investor-business-detail")} className="hover:text-[#173F6B]">Business Detail</button>
          <span>/</span>
          <span className="text-[#172033] font-medium">Proposal Review</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#172033]">Review Business Proposal</h1>
          <p className="text-sm text-[#64748B] mt-1">Review and assess the funding proposal for {biz.name}.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Document preview */}
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="bg-[#F7F9FC] border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="#64748B" strokeWidth="1.3" />
                <line x1="5" y1="5" x2="11" y2="5" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="5" y1="8" x2="11" y2="8" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="5" y1="11" x2="8" y2="11" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-semibold text-[#64748B]">BuildTech_Funding_Proposal.pdf</span>
            </div>
            <div className="p-5">
              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg p-8 text-center mb-4">
                <div className="text-[#94A3B8] text-xs">Document Preview</div>
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`h-2 bg-[#E2E8F0] rounded ${i === 3 ? "w-3/4" : i === 6 ? "w-1/2" : "w-full"}`} />
                  ))}
                </div>
              </div>
              <div className="text-xs text-[#94A3B8] text-center">BuildTech_Funding_Proposal.pdf · 2.4 MB</div>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-3 space-y-5">
            {/* Overview */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-4">Proposal Overview</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Business", value: biz.name },
                  { label: "Funding Requested", value: biz.fundingRequired },
                  { label: "Purpose", value: biz.purpose },
                  { label: "Proposal Score", value: "72 / 100" },
                ].map((f) => (
                  <div key={f.label} className="p-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg">
                    <div className="text-xs text-[#94A3B8] mb-0.5">{f.label}</div>
                    <div className="font-semibold text-sm text-[#172033]">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-semibold text-[#172033]">Proposal Sections</h2>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {biz.proposalSections.map((s) => (
                  <div key={s.section} className="flex items-center justify-between px-6 py-3.5">
                    <span className="text-sm font-medium text-[#172033]">{s.section}</span>
                    <SectionBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Investor notes */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <h2 className="font-semibold text-[#172033] mb-3">Investor Notes</h2>
              <textarea
                rows={4}
                placeholder="Add your notes about this proposal..."
                className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg outline-none focus:border-[#2563EB] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("investor-business-detail")}
                className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
              >
                Save Review
              </button>
              <button
                onClick={() => navigate("investor-business-detail")}
                className="border border-[#E2E8F0] text-[#172033] text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
              >
                Back to Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
