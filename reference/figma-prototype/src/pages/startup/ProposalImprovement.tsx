import DashboardLayout from "../../components/DashboardLayout";
import { useApp } from "../../context/AppContext";
import { proposalAnalysis } from "../../data/mockData";

export default function ProposalImprovement() {
  const { navigate } = useApp();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Proposal Assistant</div>
          <h1 className="text-2xl font-bold text-[#172033]">Suggested Improvements</h1>
          <p className="text-sm text-[#64748B] mt-1">Review suggested improvements to strengthen your funding proposal.</p>
        </div>

        <div className="space-y-5">
          {proposalAnalysis.improvements.map((imp, i) => (
            <div key={imp.area} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E2E8F0] bg-[#F7F9FC]">
                <div className="w-6 h-6 bg-[#173F6B] rounded-full flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                <h3 className="font-semibold text-[#172033]">{imp.area}</h3>
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded ${
                  imp.priority === "High" ? "bg-[#FBE9E9] text-[#C64545]" : "bg-[#FDF3E0] text-[#C98516]"
                }`}>
                  {imp.priority} Priority
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-0 divide-x divide-[#E2E8F0]">
                <div className="p-5">
                  <div className="text-xs font-semibold text-[#C64545] uppercase tracking-wider mb-2">Original</div>
                  <p className="text-sm text-[#64748B] leading-relaxed italic">"{imp.original}"</p>
                </div>
                <div className="p-5 bg-[#F7FFFE]">
                  <div className="text-xs font-semibold text-[#16845B] uppercase tracking-wider mb-2">Suggested Improvement</div>
                  <p className="text-sm text-[#172033] leading-relaxed">{imp.suggested}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-5 py-4">
          <p className="text-xs text-[#64748B]">
            <strong className="text-[#172033]">Note:</strong> Suggestions are intended to improve clarity, completeness and structure of your proposal.
            These are guidance points only — adapt them to accurately reflect your business. This is a prototype demonstration.
          </p>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => navigate("startup-action-plan")}
            className="bg-[#173F6B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
          >
            View Action Plan →
          </button>
          <button
            onClick={() => navigate("startup-proposal-assistant")}
            className="border border-[#E2E8F0] text-[#172033] text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
          >
            Back to Analysis
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
