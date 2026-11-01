import { useState } from "react";
import Logo from "../../components/Logo";
import { useApp } from "../../context/AppContext";
import { demoStartup } from "../../data/mockData";

const steps = [
  { num: "01", label: "Business" },
  { num: "02", label: "Funding" },
  { num: "03", label: "Details" },
  { num: "04", label: "Proposal" },
];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = i < current - 1;
        const active = i === current - 1;
        return (
          <div key={s.num} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done
                    ? "bg-[#16845B] border-[#16845B] text-white"
                    : active
                    ? "bg-[#173F6B] border-[#173F6B] text-white"
                    : "bg-white border-[#E2E8F0] text-[#94A3B8]"
                }`}
              >
                {done ? "✓" : s.num}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  active ? "text-[#173F6B]" : done ? "text-[#16845B]" : "text-[#94A3B8]"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-2 ${done ? "bg-[#16845B]" : "bg-[#E2E8F0]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, type = "text", children }: { label: string; value?: string; type?: string; children?: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#172033] mb-1.5">{label}</label>
      {children ?? (
        <input
          type={type}
          defaultValue={value}
          className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg bg-white outline-none focus:border-[#2563EB] transition-colors text-[#172033]"
        />
      )}
    </div>
  );
}

function Select({ label, value, options }: { label: string; value?: string; options: string[] }) {
  return (
    <Field label={label}>
      <select
        defaultValue={value}
        className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg bg-white outline-none focus:border-[#2563EB] transition-colors text-[#172033] appearance-none"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </Field>
  );
}

export default function Onboarding() {
  const { onboardingStep, setOnboardingStep, navigate, setFileUploaded, fileUploaded } = useApp();
  const [charCount, setCharCount] = useState(demoStartup.description.length);

  const goNext = () => {
    if (onboardingStep < 4) setOnboardingStep(onboardingStep + 1);
    else navigate("startup-analysis");
  };

  const goBack = () => {
    if (onboardingStep > 1) setOnboardingStep(onboardingStep - 1);
    else navigate("landing");
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] font-[Inter]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 h-16 flex items-center gap-4">
        <button onClick={() => navigate("landing")}>
          <Logo size="md" />
        </button>
        <span className="ml-2 text-xs font-semibold bg-[#EBF2FF] text-[#2563EB] px-2.5 py-1 rounded-full">
          DEMO PROFILE
        </span>
        <span className="ml-auto text-xs text-[#64748B]">Pre-filled with demo data</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Progress */}
        <div className="mb-8">
          <ProgressBar current={onboardingStep} />
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8">
          {/* Step 1: Business Information */}
          {onboardingStep === 1 && (
            <>
              <h2 className="text-xl font-bold text-[#172033] mb-1">Business Information</h2>
              <p className="text-sm text-[#64748B] mb-6">Tell us about your business.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Business / Startup Name" value={demoStartup.name} />
                </div>
                <Select label="Business Type" value={demoStartup.type} options={["Startup", "MSME", "Small Business", "Sole Proprietorship", "Partnership"]} />
                <Select label="Industry" value={demoStartup.industry} options={["Technology", "Construction Technology", "Healthcare", "Manufacturing", "Retail", "Agriculture", "Education", "Logistics", "FinTech"]} />
                <Select label="Business Stage" value={demoStartup.stage} options={["Idea", "Early Stage", "Growth", "Established"]} />
                <Field label="Location" value={demoStartup.location} />
                <Field label="Year Established" value={String(demoStartup.yearEstablished)} type="number" />
                <Field label="Number of Employees" value={String(demoStartup.employees)} type="number" />
              </div>
            </>
          )}

          {/* Step 2: Funding Requirement */}
          {onboardingStep === 2 && (
            <>
              <h2 className="text-xl font-bold text-[#172033] mb-1">Funding Requirement</h2>
              <p className="text-sm text-[#64748B] mb-6">Specify your funding needs.</p>
              <div className="bg-[#EBF2FF] border border-[#BFDBFE] rounded-lg px-4 py-3 mb-6 text-sm text-[#1e40af]">
                Your funding requirement helps identify opportunities relevant to your business.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Funding Required" value={demoStartup.fundingRequired} />
                </div>
                <Select label="Funding Type" value={demoStartup.fundingType} options={["Equity", "Debt", "Grant", "Working Capital", "Equipment Finance"]} />
                <Select label="Purpose of Funding" value={demoStartup.fundingPurpose} options={["Expansion", "Equipment", "Working Capital", "Product Development", "Marketing", "Hiring"]} />
                <div className="col-span-2">
                  <Select label="Preferred Funding Source" value={demoStartup.preferredSource} options={["Investor", "Government Scheme", "Bank / Financial Institution", "Any Suitable Option"]} />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Business Details */}
          {onboardingStep === 3 && (
            <>
              <h2 className="text-xl font-bold text-[#172033] mb-1">Business Details</h2>
              <p className="text-sm text-[#64748B] mb-6">Provide financial and team information.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Annual Revenue" value={demoStartup.annualRevenue} />
                <Field label="Monthly Revenue" value={demoStartup.monthlyRevenue} />
                <Select label="Profitability" value={demoStartup.profitability} options={["Pre-revenue", "Revenue Stage", "Break-even", "Profitable"]} />
                <Field label="Existing Investment" value={demoStartup.existingInvestment} />
                <Field label="Founder Experience" value={demoStartup.founderExperience} />
                <Field label="Team Size" value={String(demoStartup.teamSize)} type="number" />
                <div className="col-span-2">
                  <Select label="Business Registration Status" value={demoStartup.registrationStatus} options={["Registered (Private Limited)", "Registered (LLP)", "Sole Proprietorship", "Partnership", "Not Yet Registered"]} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#172033] mb-1.5">Describe your business</label>
                  <textarea
                    rows={5}
                    defaultValue={demoStartup.description}
                    onChange={(e) => setCharCount(e.target.value.length)}
                    className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-lg bg-white outline-none focus:border-[#2563EB] transition-colors text-[#172033] resize-none"
                    placeholder="Describe your product/service, target customers, business model and current stage."
                  />
                  <div className="text-right text-xs text-[#94A3B8] mt-1">{charCount} characters</div>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Proposal Upload */}
          {onboardingStep === 4 && (
            <>
              <h2 className="text-xl font-bold text-[#172033] mb-1">Upload Funding Proposal</h2>
              <p className="text-sm text-[#64748B] mb-6">Upload your funding proposal for analysis.</p>
              {!fileUploaded ? (
                <div
                  className="border-2 border-dashed border-[#E2E8F0] rounded-xl p-12 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#F7F9FC] transition-all"
                  onClick={() => setFileUploaded(true)}
                >
                  <div className="w-14 h-14 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="2" width="16" height="20" rx="2" stroke="#64748B" strokeWidth="1.5" />
                      <line x1="8" y1="8" x2="16" y2="8" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="8" y1="12" x2="16" y2="12" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="8" y1="16" x2="12" y2="16" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="font-semibold text-[#172033] mb-1">Upload your business proposal</div>
                  <div className="text-xs text-[#64748B] mb-4">Supported formats: PDF, DOCX · Max 25MB</div>
                  <button className="text-sm font-semibold bg-[#173F6B] text-white px-5 py-2 rounded-lg hover:bg-[#1e4d82] transition-colors">
                    Browse File
                  </button>
                  <div className="mt-4 text-xs text-[#94A3B8]">or drag and drop file here</div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 bg-[#E8F5F0] border border-[#A7D7C2] rounded-xl px-5 py-4 mb-6">
                    <div className="w-8 h-8 bg-[#16845B] rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">✓</span>
                    </div>
                    <div>
                      <div className="font-semibold text-[#172033] text-sm">BuildTech_Funding_Proposal.pdf</div>
                      <div className="text-xs text-[#16845B]">Uploaded successfully · 2.4 MB</div>
                    </div>
                    <button
                      className="ml-auto text-xs text-[#64748B] hover:text-[#C64545]"
                      onClick={() => setFileUploaded(false)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#64748B]">
                    Ready to analyse your business profile and proposal. Click <strong>Analyse My Business</strong> to continue.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E2E8F0]">
            <button
              onClick={goBack}
              className="text-sm font-medium text-[#64748B] border border-[#E2E8F0] px-5 py-2.5 rounded-lg hover:bg-[#F7F9FC] transition-colors"
            >
              Back
            </button>
            <button
              onClick={goNext}
              className="text-sm font-semibold bg-[#173F6B] text-white px-6 py-2.5 rounded-lg hover:bg-[#1e4d82] transition-colors"
            >
              {onboardingStep === 4 ? "Analyse My Business" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
