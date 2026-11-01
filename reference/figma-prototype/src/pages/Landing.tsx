import Logo from "../components/Logo";
import { useApp } from "../context/AppContext";

const features = [
  {
    title: "Funding Readiness",
    desc: "Understand how prepared your business is for funding with a detailed readiness score.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#173F6B" strokeWidth="1.5" />
        <path d="M10 6v4l3 2" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Investor Matching",
    desc: "Find potential investors aligned with your business stage, industry and funding requirement.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="8" r="3" stroke="#173F6B" strokeWidth="1.5" />
        <circle cx="14" cy="8" r="3" stroke="#173F6B" strokeWidth="1.5" />
        <path d="M2 16c0-2.5 2-4 5-4s5 1.5 5 4" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 12c2 0 4 1 4 3" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Government Schemes",
    desc: "Discover relevant government funding schemes and assess your potential eligibility.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="8" width="16" height="10" rx="1.5" stroke="#173F6B" strokeWidth="1.5" />
        <path d="M10 3L2 8h16L10 3z" stroke="#173F6B" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="8" y="12" width="4" height="6" rx="0.5" stroke="#173F6B" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Proposal Assistant",
    desc: "Identify areas where your funding proposal can improve with structured analysis.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="#173F6B" strokeWidth="1.5" />
        <line x1="7" y1="7" x2="13" y2="7" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="10" x2="13" y2="10" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="13" x2="10" y2="13" stroke="#173F6B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const steps = [
  { step: "01", title: "Build Business Profile", desc: "Enter your business information, industry, stage and location." },
  { step: "02", title: "Enter Funding Requirement", desc: "Specify the funding amount, type and purpose of your requirement." },
  { step: "03", title: "Analyse Funding Readiness", desc: "The system analyses your profile and generates a readiness score." },
  { step: "04", title: "Discover Funding Opportunities", desc: "Explore matched investors and government schemes relevant to your business." },
  { step: "05", title: "Improve Your Proposal", desc: "Review structured suggestions to strengthen your funding proposal." },
];

export default function Landing() {
  const { navigate, setRole } = useApp();

  const handleGetStarted = () => {
    setRole("startup");
    navigate("startup-onboarding");
  };

  return (
    <div className="min-h-full bg-white font-[Inter] text-[#172033]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
          <Logo size="md" />
          <nav className="hidden md:flex items-center gap-6 ml-6">
            {["Home", "How It Works", "Funding", "About"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-[#64748B] hover:text-[#172033] font-medium transition-colors"
                onClick={(e) => { e.preventDefault(); if (item === "How It Works") document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); }}
              >
                {item}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button className="text-sm font-medium text-[#64748B] hover:text-[#172033] transition-colors px-3 py-1.5">
              Sign In
            </button>
            <button
              onClick={handleGetStarted}
              className="text-sm font-semibold bg-[#173F6B] text-white px-4 py-2 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#EBF2FF] text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
            AI-Powered Funding Decision Support · Prototype
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#172033] leading-tight mb-5">
            Find the Right Funding.{" "}
            <span className="text-[#173F6B]">Know Why.</span>
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed mb-8 max-w-lg">
            FundBridge AI helps startups and MSMEs discover relevant funding opportunities, assess
            funding readiness, match with potential investors and improve funding proposals.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGetStarted}
              className="text-sm font-semibold bg-[#173F6B] text-white px-6 py-3 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate("demo-role-select")}
              className="text-sm font-semibold bg-[#2563EB] text-white px-6 py-3 rounded-lg hover:bg-[#1d52c8] transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              Try Demo
            </button>
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-semibold text-[#173F6B] border border-[#173F6B] px-6 py-3 rounded-lg hover:bg-[#F7F9FC] transition-colors"
            >
              See How It Works
            </button>
          </div>
        </div>

        {/* Workflow diagram */}
        <div className="flex justify-center">
          <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-2xl p-8 w-72">
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-6 text-center">
              How It Works
            </div>
            {[
              { label: "Business Profile", color: "#EBF2FF", text: "#2563EB" },
              { label: "AI Analysis", color: "#E8F5F0", text: "#16845B" },
              { label: "Funding Opportunities", color: "#FDF3E0", text: "#C98516" },
              { label: "Explainable Recommendations", color: "#173F6B", text: "white" },
            ].map((item, i) => (
              <div key={item.label} className="flex flex-col items-center">
                <div
                  className="w-full px-4 py-3 rounded-lg text-sm font-semibold text-center"
                  style={{ background: item.color, color: item.text }}
                >
                  {item.label}
                </div>
                {i < 3 && (
                  <div className="flex flex-col items-center my-2">
                    <div className="w-0.5 h-4 bg-[#CBD5E1]" />
                    <div className="w-2 h-2 bg-[#CBD5E1] rotate-45 -mt-0.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F7F9FC] border-y border-[#E2E8F0] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#172033] mb-2">Platform Capabilities</h2>
            <p className="text-[#64748B] text-sm">Designed for startups, MSMEs and small businesses seeking funding clarity.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="w-10 h-10 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#172033] mb-2 text-sm">{f.title}</h3>
                <p className="text-[#64748B] text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-[#172033] mb-2">How It Works</h2>
          <p className="text-[#64748B] text-sm">Five steps from business profile to funding action plan.</p>
        </div>
        <div className="grid md:grid-cols-5 gap-4 mb-12">
          {steps.map((s, i) => (
            <div key={s.step} className="relative">
              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-5 h-full">
                <div className="text-2xl font-bold text-[#E2E8F0] mb-3">{s.step}</div>
                <h3 className="font-semibold text-[#172033] text-sm mb-2">{s.title}</h3>
                <p className="text-[#64748B] text-xs leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 text-[#CBD5E1] text-lg z-10">→</div>
              )}
            </div>
          ))}
        </div>

        {/* Flow summary */}
        <div className="bg-[#173F6B] rounded-xl p-6 flex flex-wrap items-center justify-center gap-4">
          {["Business Information", "FundBridge AI Analysis", "Funding Recommendations", "Action Plan"].map((item, i) => (
            <div key={item} className="flex items-center gap-4">
              <span className="text-white text-sm font-medium">{item}</span>
              {i < 3 && <span className="text-white/40 text-lg">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#F7F9FC] border-t border-[#E2E8F0] py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-[#172033] mb-3">Ready to Explore?</h2>
          <p className="text-[#64748B] mb-8 text-sm">Try the full prototype with a pre-filled startup or investor demo.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("demo-role-select")}
              className="font-semibold bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-[#1d52c8] transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              Try Demo
            </button>
            <button
              onClick={handleGetStarted}
              className="font-semibold bg-[#173F6B] text-white px-8 py-3 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              Get Started
            </button>
          </div>
          <p className="text-xs text-[#94A3B8] mt-4">
            This is a prototype for demonstration purposes. All data shown is sample data only.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <Logo size="sm" />
          <p className="text-xs text-[#94A3B8]">
            FundBridge AI Prototype · Demo Build · All match scores are sample data
          </p>
        </div>
      </footer>
    </div>
  );
}
