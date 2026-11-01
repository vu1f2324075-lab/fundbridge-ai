import { AppProvider, useApp } from "./context/AppContext";
import DemoControl from "./components/DemoControl";

// Pages
import Landing from "./pages/Landing";
import DemoRoleSelect from "./pages/DemoRoleSelect";
import Onboarding from "./pages/startup/Onboarding";
import Analysis from "./pages/startup/Analysis";
import Dashboard from "./pages/startup/Dashboard";
import FundingReadiness from "./pages/startup/FundingReadiness";
import InvestorMatching from "./pages/startup/InvestorMatching";
import InvestorDetail from "./pages/startup/InvestorDetail";
import GovernmentSchemes from "./pages/startup/GovernmentSchemes";
import SchemeDetail from "./pages/startup/SchemeDetail";
import Recommendations from "./pages/startup/Recommendations";
import ExplainableRec from "./pages/startup/ExplainableRec";
import ProposalAssistant from "./pages/startup/ProposalAssistant";
import ProposalImprovement from "./pages/startup/ProposalImprovement";
import ActionPlan from "./pages/startup/ActionPlan";
import SavedOpportunities from "./pages/startup/SavedOpportunities";
import BusinessProfile from "./pages/startup/BusinessProfile";
import Settings from "./pages/startup/Settings";
import InvestorDashboard from "./pages/investor/InvestorDashboard";
import BusinessMatches from "./pages/investor/BusinessMatches";
import BusinessDetail from "./pages/investor/BusinessDetail";
import DiscoverBusinesses from "./pages/investor/DiscoverBusinesses";
import FundingPreferences from "./pages/investor/FundingPreferences";
import ProposalReview from "./pages/investor/ProposalReview";
import SavedBusinesses from "./pages/investor/SavedBusinesses";
import Notifications from "./pages/investor/Notifications";
import InvestorProfile from "./pages/investor/InvestorProfile";
import InvestorSettings from "./pages/investor/InvestorSettings";

function Router() {
  const { page } = useApp();

  const pageMap: Record<string, React.ReactNode> = {
    "landing": <Landing />,
    "how-it-works": <Landing />,
    "demo-role-select": <DemoRoleSelect />,
    "startup-onboarding": <Onboarding />,
    "startup-analysis": <Analysis />,
    "startup-dashboard": <Dashboard />,
    "startup-funding-readiness": <FundingReadiness />,
    "startup-investor-matching": <InvestorMatching />,
    "startup-investor-detail": <InvestorDetail />,
    "startup-govt-schemes": <GovernmentSchemes />,
    "startup-scheme-detail": <SchemeDetail />,
    "startup-recommendations": <Recommendations />,
    "startup-explainable": <ExplainableRec />,
    "startup-proposal-assistant": <ProposalAssistant />,
    "startup-proposal-improvement": <ProposalImprovement />,
    "startup-action-plan": <ActionPlan />,
    "startup-saved": <SavedOpportunities />,
    "startup-business-profile": <BusinessProfile />,
    "startup-settings": <Settings />,
    "investor-dashboard": <InvestorDashboard />,
    "investor-business-matches": <BusinessMatches />,
    "investor-business-detail": <BusinessDetail />,
    "investor-discover": <DiscoverBusinesses />,
    "investor-preferences": <FundingPreferences />,
    "investor-proposal-review": <ProposalReview />,
    "investor-saved": <SavedBusinesses />,
    "investor-notifications": <Notifications />,
    "investor-profile": <InvestorProfile />,
    "investor-settings": <InvestorSettings />,
  };

  const showDemoControl = page !== "landing" && page !== "how-it-works";

  return (
    <div className="size-full">
      {pageMap[page] ?? <Landing />}
      {showDemoControl && <DemoControl />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
