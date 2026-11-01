import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { investors, schemes, readinessScores, proposalAnalysis } from "../../data/mockData";

const nextSteps: { num: string; title: string; desc: string }[] = [
  { num: "01", title: "Complete financial projections", desc: "Add 12–24 month projections to your proposal." },
  { num: "02", title: "Add market validation", desc: "Include measurable customer or market evidence." },
  { num: "03", title: "Review Alpha Ventures requirements", desc: "Check investment criteria and preferred contact method." },
  { num: "04", title: "Review scheme eligibility", desc: "Verify official Startup India Seed Fund requirements." },
  { num: "05", title: "Prepare required documents", desc: "Compile documentation required by target investors and schemes." },
];

export default function ActionPlan() {
  const { navigate } = useApp();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Action Plan</div>
          <h1 className="text-2xl font-bold text-[#172033]">Your Funding Action Plan</h1>
          <p className="text-sm text-[#64748B] mt-1">A consolidated view of your funding readiness and recommended next steps.</p>
        </div>

        {/* Business header */}
        <div className="bg-[#173F6B] rounded-xl p-6 text-white mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">DEMO PROFILE</div>
              <h2 className="text-xl font-bold mb-0.5">BuildTech Solutions</h2>
              <div className="text-white/70 text-sm">Construction Technology · Mumbai · Growth Stage</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{readinessScores.overall}</div>
              <div className="text-white/60 text-xs">Readiness Score / 100</div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Readiness Score", value: `${readinessScores.overall}/100`, color: "#173F6B" },
            { label: "Top Investor Match", value: `${investors[0].match}%`, color: "#16845B" },
            { label: "Top Scheme Match", value: `${schemes[0].match}%`, color: "#C98516" },
            { label: "Proposal Score", value: `${proposalAnalysis.overall}/100`, color: "#2563EB" },
          ].map((c) => (
            <div key={c.label} className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="text-xs text-[#64748B]">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Top matches */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Top Investor Matches</div>
            {investors.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-[#F1F5F9] last:border-0">
                <div>
                  <div className="font-medium text-sm text-[#172033]">{inv.name}</div>
                  <div className="text-xs text-[#64748B]">{inv.range}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#16845B]">{inv.match}%</span>
                  <button
                    onClick={() => navigate("startup-investor-detail")}
                    className="text-xs text-[#173F6B] border border-[#E2E8F0] px-2 py-0.5 rounded hover:bg-[#EBF2FF]"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Top Government Schemes</div>
            {schemes.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-[#F1F5F9] last:border-0">
                <div>
                  <div className="font-medium text-sm text-[#172033]">{s.name}</div>
                  <div className="text-xs text-[#64748B]">{s.support}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#C98516]">{s.match}%</span>
                  <button
                    onClick={() => navigate("startup-scheme-detail")}
                    className="text-xs text-[#173F6B] border border-[#E2E8F0] px-2 py-0.5 rounded hover:bg-[#EBF2FF]"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next steps */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 mb-5">
          <h2 className="font-semibold text-[#172033] mb-5">Recommended Next Steps</h2>
          <div className="space-y-3">
            {nextSteps.map((step) => (
              <div key={step.num} className="flex items-start gap-4 p-4 border border-[#E2E8F0] rounded-lg hover:bg-[#F7F9FC] transition-colors">
                <div className="w-8 h-8 bg-[#173F6B] rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  {step.num}
                </div>
                <div>
                  <div className="font-semibold text-sm text-[#172033] mb-0.5">{step.title}</div>
                  <div className="text-xs text-[#64748B]">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-5 py-4 mb-5">
          <p className="text-xs text-[#64748B]">
            This action plan is based on sample data for prototype demonstration. Match scores and readiness
            assessments shown are simulated results.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate("startup-dashboard")}
            className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
          >
            Save Action Plan
          </button>
          <button
            onClick={() => navigate("startup-investor-matching")}
            className="border border-[#E2E8F0] text-[#172033] text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
          >
            View Investor Matches
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
