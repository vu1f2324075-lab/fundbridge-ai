/**
 * Types for the proposal, investor and admin modules.
 *
 * Kept separate from `api.ts` (which covers public + business-owner) so the
 * three later modules can evolve without churn in the original file.
 */
import type { Role, Scheme } from './api';

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export type ProposalStatus =
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'EXTRACTED'
  | 'EXTRACTION_FAILED'
  | 'ANALYSING'
  | 'ANALYSED'
  | 'ANALYSIS_FAILED';

export interface ImprovementSuggestion {
  area: string;
  issue: string;
  suggestion: string;
  why_it_matters: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProposalAnalysis {
  id: string;
  overallScore: number;
  clarityScore: number;
  completenessScore: number;
  structureScore: number;
  marketEvidenceScore: number;
  financialScore: number;
  fundingJustificationScore: number;
  teamScore: number;
  identifiedStrengths: string[];
  identifiedWeaknesses: string[];
  missingSections: string[];
  improvementSuggestions: ImprovementSuggestion[];
  /** True when a model phrased the narrative. Scores are always deterministic. */
  llmAssisted: boolean;
  modelVersion: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  /** SHA-256 of the stored bytes. Lets a reader confirm the file is intact. */
  checksum: string | null;
  status: ProposalStatus;
  statusMessage: string | null;
  sections: Record<string, string> | null;
  wordCount: number | null;
  createdAt: string;
  /**
   * Canonical API path for the stored file, e.g. `/api/proposals/<id>/download`.
   *
   * Authenticated and ownership-checked, so it cannot be opened by pasting it
   * into an address bar — it has to be fetched by the signed-in owner. The
   * viewer uses `apiBlob` for exactly that reason.
   */
  downloadUrl: string;
  analyses: ProposalAnalysis[];
}

export interface UploadResult {
  proposalId: string;
  status: ProposalStatus;
  message: string | null;
  analysed: boolean;
}

export interface SectionSuggestion {
  section: string;
  draft: string | null;
  guidance: string[];
  /** Facts the section needs that the system does not hold. Asked, never invented. */
  missing_facts: string[];
  llm_assisted: boolean;
  llm_note: string | null;
}

export interface RagCitation {
  chunkId: string;
  schemeId: string | null;
  schemeName: string | null;
  documentTitle: string;
  sourceUrl: string;
  lastVerifiedAt: string | null;
  similarity: number;
  excerpt: string;
}

export interface RagAnswer {
  narrative: string | null;
  citations: RagCitation[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Investor
// ---------------------------------------------------------------------------

export interface InvestorProfile {
  id: string;
  investorName: string;
  investorType: string;
  description: string | null;
  minInvestment: number | null;
  maxInvestment: number | null;
  industries: string[];
  preferredStages: string[];
  preferredLocations: string[];
  fundingTypes: string[];
  investmentPreferences: string | null;
  website: string | null;
  verification: string;
  active: boolean;
}

/**
 * The narrow view an investor sees of a business.
 *
 * Exact financial figures are deliberately absent — the backend substitutes a
 * coarse `revenueBand`. Proposals are never included.
 */
export interface DiscoverableBusiness {
  id: string;
  businessName: string;
  businessType: string | null;
  industry: string | null;
  subIndustry: string | null;
  location: string | null;
  state: string | null;
  foundedYear: number | null;
  businessStage: string | null;
  teamSize: number | null;
  description: string | null;
  problem: string | null;
  solution: string | null;
  targetCustomer: string | null;
  productStatus: string | null;
  customerCount: number | null;
  growthRate: number | null;
  partnerships: string[];
  certifications: string[];
  intellectualProperty: string[];
  founderExperience: number | null;
  teamStrength: string | null;
  udyamRegistered: boolean | null;
  dpiitRecognised: boolean | null;
  revenueBand: string;
  fundingRequirement: {
    amountRequired: number;
    currency: string;
    purpose: string;
    fundingType: string;
    preferredTimeline: string | null;
    preferredLocation: string | null;
  } | null;
}

export type FitOutcome = 'MATCH' | 'MISMATCH' | 'UNSTATED' | 'UNKNOWN';

export interface InvestorFactor {
  key: string;
  name: string;
  score: number;
  weight: number;
  outcome: FitOutcome;
  reason: string;
}

export interface InvestorMatch {
  id: string;
  businessId: string;
  overallScore: number;
  matchedFactors: string[];
  missingFactors: string[];
  explanation: {
    investorName: string;
    overallScore: number;
    factors: InvestorFactor[];
    matchedFactors: string[];
    missingFactors: string[];
    disclaimer: string;
  };
  modelVersion: string;
  business: DiscoverableBusiness;
}

export type ShortlistStatus = 'WATCHING' | 'CONTACTED' | 'IN_REVIEW' | 'PASSED';

export interface ShortlistEntry {
  id: string;
  businessId: string;
  status: ShortlistStatus;
  notes: string | null;
  createdAt: string;
  business: DiscoverableBusiness;
}

export interface InvestorDashboard {
  profile: InvestorProfile;
  preferences: { complete: number; total: number; percent: number };
  matches: { total: number; strong: number };
  shortlistCount: number;
  discoverableBusinesses: number;
  topMatches: InvestorMatch[];
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type SchemeStatus =
  | 'DRAFT'
  | 'NEEDS_VERIFICATION'
  | 'VERIFIED'
  | 'PUBLISHED'
  | 'NEEDS_REVERIFICATION'
  | 'ARCHIVED';

export interface AdminScheme extends Scheme {
  notes: string | null;
  verifiedById: string | null;
  eligibilityRules: Record<string, unknown> | null;
  _count?: { matches: number; revisions: number; documents: number };
}

export interface SchemeRevision {
  id: string;
  snapshot: Record<string, unknown>;
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  businessProfile: { id: string; businessName: string } | null;
  investorProfile: { id: string; investorName: string; verification: string } | null;
}

export interface SystemStatus {
  aiService:
    | {
        reachable: true;
        version: string;
        embeddings: boolean;
        embeddingModel: string | null;
        llm: boolean;
        llmModel: string | null;
      }
    | { reachable: false; reason: string };
  rag: {
    documents: number;
    publishedDocuments: number;
    chunks: number;
    embeddedChunks: number;
    schemesIndexed: number;
    schemesPublished: number;
    embeddingModels: string[];
    lastIndexedAt: string | null;
  };
  data: {
    users: number;
    businesses: number;
    investors: number;
    publishedSchemes: number;
    schemeMatches: number;
    readinessRecords: number;
    proposals: number;
  };
}

export interface DataQualityReport {
  schemes: {
    total: number;
    byStatus: Record<string, number>;
    missingApplicationUrl: number;
    missingFundingRange: number;
    missingEligibility: number;
    missingDocuments: number;
    neverVerified: number;
    staleVerification: number;
    syntheticRecords: number;
    /** Real provenance counts, keyed by RagSourceType. Never inferred. */
    bySourceType: Record<string, number>;
    duplicateCandidates: Array<{ normalisedName: string; count: number }>;
  };
  businesses: { total: number; missingFinancials: number; missingFundingRequirement: number };
  proposals: { total: number; extracted: number; extractionFailed: number; analysed: number };
}

export interface SecurityOverview {
  windowHours: number;
  failedLogins: number;
  failedLoginsByIp: Array<{ ip: string; count: number }>;
  privilegedActions: number;
  suspendedUsers: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; email: string; role: Role } | null;
}

export interface MatchingConfigEntry {
  key: string;
  version: number;
  value: unknown;
  /** True when nothing is stored and the code default is in use. */
  isDefault: boolean;
}

export interface RagIndexStats {
  documents: number;
  publishedDocuments: number;
  chunks: number;
  embeddedChunks: number;
  schemesIndexed: number;
  schemesPublished: number;
  embeddingModels: string[];
  lastIndexedAt: string | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
