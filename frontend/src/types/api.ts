/**
 * API response types.
 *
 * Hand-written to mirror the backend's serialised shapes. Money arrives as
 * `number` (the backend converts Prisma `Decimal` at the boundary) and dates as
 * ISO strings.
 */

export type Role = 'STARTUP' | 'INVESTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  businessProfileId?: string;
  investorProfileId?: string;
}

export interface BusinessProfile {
  id: string;
  businessName: string;
  businessType: string | null;
  industry: string | null;
  subIndustry: string | null;
  location: string | null;
  state: string | null;
  country: string | null;
  foundedYear: number | null;
  businessStage: string | null;
  teamSize: number | null;
  description: string | null;
  problem: string | null;
  solution: string | null;
  targetCustomer: string | null;
  productStatus: string | null;
  customerCount: number | null;
  annualRevenue: number | null;
  annualExpenses: number | null;
  profitLoss: number | null;
  existingFunding: number | null;
  existingDebt: number | null;
  growthRate: number | null;
  marketSize: number | null;
  founderExperience: number | null;
  teamStrength: string | null;
  customers: string[];
  partnerships: string[];
  certifications: string[];
  intellectualProperty: string[];
  udyamRegistered: boolean | null;
  dpiitRecognised: boolean | null;
  gstRegistered: boolean | null;
  registrationNumber: string | null;
  discoverable: boolean;
  sourceType: string;
  fundingRequirement: FundingRequirement | null;
}

export interface FundingRequirement {
  id: string;
  amountRequired: number;
  currency: string;
  purpose: string;
  fundingType: string;
  preferredTimeline: string | null;
  preferredLocation: string | null;
  additionalRequirements: string | null;
}

export interface ReadinessComponent {
  key: 'businessProfile' | 'financialInformation' | 'marketValidation' | 'teamStrength' | 'proposalQuality';
  name: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
  missing: string[];
}

export interface Readiness {
  overallScore: number;
  category: string;
  components: ReadinessComponent[];
  missingInformation: string[];
  recommendations: string[];
  modelVersion: string;
  configVersion: string | null;
  updatedAt?: string;
}

export type MatchStatus = 'POTENTIALLY_ELIGIBLE' | 'NEEDS_INFORMATION' | 'REVIEW_REQUIRED' | 'LIKELY_NOT_ELIGIBLE';

export type FactorOutcome = 'MATCH' | 'MISMATCH' | 'UNRESTRICTED' | 'UNKNOWN';

export interface MatchFactor {
  key: string;
  name: string;
  score: number;
  weight: number;
  outcome: FactorOutcome;
  reason: string;
}

export interface Scheme {
  id: string;
  slug: string;
  name: string;
  provider: string;
  ministry: string | null;
  department: string | null;
  level: 'CENTRAL' | 'STATE';
  schemeType: string;
  targetBusinessTypes: string[];
  supportedIndustries: string[];
  supportedStages: string[];
  supportedLocations: string[];
  supportedFundingTypes: string[];
  supportedPurposes: string[];
  minFunding: number | null;
  maxFunding: number | null;
  fundingDescription: string | null;
  description: string | null;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  applicationProcess: string | null;
  applicationUrl: string | null;
  officialSourceUrl: string;
  status: string;
  source: string;
  /** SYNTHETIC marks a demonstration record; the UI badges these. */
  sourceType: string;
  lastVerifiedAt: string | null;
}

export interface SchemeMatchExplanation {
  schemeName: string;
  eligibilityScore: number;
  status: MatchStatus;
  factors: MatchFactor[];
  matchedCriteria: string[];
  missingCriteria: string[];
  blockingIssues: string[];
  statedCriteria: string[];
  requiredDocuments: string[];
  disclaimer: string;
}

export interface SchemeMatch {
  id: string;
  schemeId: string;
  eligibilityScore: number;
  status: MatchStatus;
  matchedCriteria: string[];
  missingCriteria: string[];
  blockingIssues: string[];
  explanation: SchemeMatchExplanation;
  /** LLM-phrased prose; null when unavailable, and the UI then renders factors. */
  narrative: string | null;
  modelVersion: string;
  configVersion: string | null;
  semanticScore: number | null;
  scheme: Scheme;
  updatedAt: string;
}

export type ActionPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type ActionStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  priority: ActionPriority;
  status: ActionStatus;
  sourceModule: string;
  sourceKey: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface ProfileCompletion {
  overall: number;
  sections: Array<{ key: string; name: string; complete: number; total: number }>;
}

export interface Dashboard {
  completion: ProfileCompletion;
  readiness: Readiness | null;
  requirement: FundingRequirement | null;
  schemeMatches: {
    total: number;
    potentiallyEligible: number;
    needsInformation: number;
    top: SchemeMatch[];
  };
  actionPlan: { total: number; open: number; highPriority: number };
  savedCount: number;
  proposal: {
    uploaded: number;
    analysed: number;
    latestScore: number | null;
    /** Whether the AI service is configured; extraction and analysis need it. */
    available: boolean;
  };
}

export interface SavedOpportunity {
  id: string;
  opportunityType: 'SCHEME' | 'INVESTOR';
  opportunityId: string;
  notes: string | null;
  createdAt: string;
  /** Null when the target has since been unpublished. */
  target: Record<string, unknown> | null;
}

export interface Meta {
  vocabularies: {
    industries: string[];
    fundingPurposes: string[];
    businessTypes: string[];
    businessStages: string[];
    productStatuses: string[];
    fundingTypes: string[];
  };
  /** What is genuinely implemented. The UI hides controls for anything false. */
  features: Record<string, boolean>;
  disclaimer: string;
}
