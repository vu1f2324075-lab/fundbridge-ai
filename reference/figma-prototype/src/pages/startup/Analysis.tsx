import { useState, useEffect } from "react";
import Logo from "../../components/Logo";
import { useApp } from "../../context/AppContext";

const analysisSteps = [
  "Reading business information",
  "Analysing funding requirement",
  "Checking funding opportunities",
  "Preparing recommendations",
];

export default function Analysis() {
  const { navigate } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (currentStep < analysisSteps.length) {
      const t = setTimeout(() => setCurrentStep((s) => s + 1), 900);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setComplete(true), 400);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] font-[Inter] flex flex-col">
      <header className="bg-white border-b border-[#E2E8F0] px-6 h-16 flex items-center">
        <Logo size="md" />
        <span className="ml-4 text-xs font-semibold bg-[#EBF2FF] text-[#2563EB] px-2.5 py-1 rounded-full">
          AI Analysis · Prototype
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
            {!complete ? (
              <>
                <div className="w-14 h-14 bg-[#EBF2FF] rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-6 h-6 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-[#172033] mb-2">Analysing Your Business</h2>
                <p className="text-sm text-[#64748B] mb-8">
                  Processing your business profile and identifying relevant funding opportunities.
                </p>
                <div className="text-left space-y-4">
                  {analysisSteps.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-all ${
                            done
                              ? "bg-[#16845B] border-[#16845B] text-white"
                              : active
                              ? "border-[#2563EB] border-2 bg-white"
                              : "border-[#E2E8F0] bg-white"
                          }`}
                        >
                          {done ? "✓" : active ? <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-pulse" /> : ""}
                        </div>
                        <span
                          className={`text-sm font-medium transition-colors ${
                            done ? "text-[#16845B]" : active ? "text-[#172033]" : "text-[#94A3B8]"
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="12" fill="#16845B" />
                    <path d="M8 14l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#172033] mb-2">Analysis Complete</h2>
                <p className="text-sm text-[#64748B] mb-6">
                  We have analysed your business profile and prepared your funding overview.
                </p>

                <div className="space-y-3 mb-8">
                  {analysisSteps.map((step) => (
                    <div key={step} className="flex items-center gap-3 text-left">
                      <div className="w-6 h-6 rounded-full bg-[#16845B] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <span className="text-sm text-[#16845B] font-medium">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Readiness Score", value: "78/100" },
                    { label: "Investor Matches", value: "8" },
                    { label: "Schemes Found", value: "5" },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg p-3 text-center">
                      <div className="font-bold text-[#173F6B] text-lg">{item.value}</div>
                      <div className="text-[10px] text-[#64748B]">{item.label}</div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[#94A3B8] mb-6">
                  Results shown are sample data for this prototype demonstration.
                </p>

                <button
                  onClick={() => navigate("startup-dashboard")}
                  className="w-full bg-[#173F6B] text-white text-sm font-semibold py-3 rounded-lg hover:bg-[#1e4d82] transition-colors"
                >
                  View Funding Dashboard →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
