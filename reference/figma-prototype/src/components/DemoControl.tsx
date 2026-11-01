import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function DemoControl() {
  const { role, navigate, resetDemo } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const skipToDashboard = () => {
    if (role === "investor") {
      navigate("investor-dashboard");
    } else {
      navigate("startup-dashboard");
    }
    showToast("Skipped to dashboard");
    setExpanded(false);
  };

  const handleReset = () => {
    resetDemo();
    showToast("Demo reset");
    setExpanded(false);
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#172033] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[9999] transition-all">
          {toast}
        </div>
      )}

      {/* Floating panel */}
      <div className="fixed bottom-4 right-4 z-[9998] flex flex-col items-end gap-2">
        {expanded && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-4 min-w-[220px]">
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
              Demo Controls
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={skipToDashboard}
                className="w-full text-left text-sm px-3 py-2 rounded-lg bg-[#F7F9FC] hover:bg-[#EBF2FF] text-[#172033] font-medium transition-colors"
              >
                Skip to Dashboard
              </button>
              <button
                onClick={() => { navigate("demo-role-select"); setExpanded(false); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg bg-[#F7F9FC] hover:bg-[#EBF2FF] text-[#172033] font-medium transition-colors"
              >
                Switch Role
              </button>
              <button
                onClick={() => { navigate("startup-investor-detail"); setExpanded(false); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg bg-[#F7F9FC] hover:bg-[#EBF2FF] text-[#172033] font-medium transition-colors"
              >
                View: Why This Match?
              </button>
              <button
                onClick={() => { navigate("startup-action-plan"); setExpanded(false); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg bg-[#F7F9FC] hover:bg-[#EBF2FF] text-[#172033] font-medium transition-colors"
              >
                View: Action Plan
              </button>
              <div className="border-t border-[#E2E8F0] my-1" />
              <button
                onClick={handleReset}
                className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-[#FBE9E9] text-[#C64545] font-medium transition-colors"
              >
                Reset Demo
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 bg-[#172033] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg hover:bg-[#1e2940] transition-colors"
        >
          <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full animate-pulse" />
          DEMO MODE
          <span className="text-white/50">{expanded ? "▾" : "▴"}</span>
        </button>
      </div>
    </>
  );
}
