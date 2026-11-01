import { createContext, useContext, useState, type ReactNode } from "react";

export type AppPage =
  | "landing"
  | "how-it-works"
  | "demo-role-select"
  | "startup-onboarding"
  | "startup-analysis"
  | "startup-dashboard"
  | "startup-funding-readiness"
  | "startup-investor-matching"
  | "startup-investor-detail"
  | "startup-govt-schemes"
  | "startup-scheme-detail"
  | "startup-recommendations"
  | "startup-explainable"
  | "startup-proposal-assistant"
  | "startup-proposal-improvement"
  | "startup-action-plan"
  | "startup-saved"
  | "startup-business-profile"
  | "startup-settings"
  | "investor-dashboard"
  | "investor-business-matches"
  | "investor-business-detail"
  | "investor-discover"
  | "investor-preferences"
  | "investor-proposal-review"
  | "investor-saved"
  | "investor-notifications"
  | "investor-profile"
  | "investor-settings";

interface AppCtx {
  page: AppPage;
  role: "startup" | "investor" | null;
  onboardingStep: number;
  selectedInvestorId: string | null;
  selectedSchemeId: string | null;
  selectedBusinessId: string | null;
  savedInvestors: string[];
  savedSchemes: string[];
  shortlistedBusinesses: string[];
  fileUploaded: boolean;
  navigate: (p: AppPage) => void;
  setRole: (r: "startup" | "investor") => void;
  setOnboardingStep: (s: number) => void;
  setSelectedInvestor: (id: string | null) => void;
  setSelectedScheme: (id: string | null) => void;
  setSelectedBusiness: (id: string | null) => void;
  toggleSavedInvestor: (id: string) => void;
  toggleSavedScheme: (id: string) => void;
  toggleShortlisted: (id: string) => void;
  setFileUploaded: (v: boolean) => void;
  resetDemo: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<AppPage>("landing");
  const [role, setRoleState] = useState<"startup" | "investor" | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [selectedInvestorId, setSelectedInvestor] = useState<string | null>(null);
  const [selectedSchemeId, setSelectedScheme] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusiness] = useState<string | null>(null);
  const [savedInvestors, setSavedInvestors] = useState<string[]>([]);
  const [savedSchemes, setSavedSchemes] = useState<string[]>([]);
  const [shortlistedBusinesses, setShortlisted] = useState<string[]>([]);
  const [fileUploaded, setFileUploaded] = useState(false);

  const navigate = (p: AppPage) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  const setRole = (r: "startup" | "investor") => setRoleState(r);

  const toggleSavedInvestor = (id: string) =>
    setSavedInvestors((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSavedScheme = (id: string) =>
    setSavedSchemes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleShortlisted = (id: string) =>
    setShortlisted((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const resetDemo = () => {
    setPage("landing");
    setRoleState(null);
    setOnboardingStep(1);
    setSelectedInvestor(null);
    setSelectedScheme(null);
    setSelectedBusiness(null);
    setSavedInvestors([]);
    setSavedSchemes([]);
    setShortlisted([]);
    setFileUploaded(false);
  };

  return (
    <Ctx.Provider
      value={{
        page, role, onboardingStep, selectedInvestorId, selectedSchemeId,
        selectedBusinessId, savedInvestors, savedSchemes, shortlistedBusinesses,
        fileUploaded, navigate, setRole, setOnboardingStep, setSelectedInvestor,
        setSelectedScheme, setSelectedBusiness, toggleSavedInvestor,
        toggleSavedScheme, toggleShortlisted, setFileUploaded, resetDemo,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
