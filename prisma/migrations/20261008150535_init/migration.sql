-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STARTUP', 'INVESTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BusinessStage" AS ENUM ('IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'FPO', 'SOCIETY', 'TRUST', 'SELF_HELP_GROUP', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('CONCEPT', 'IN_DEVELOPMENT', 'PILOT', 'LAUNCHED', 'SCALING');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('EQUITY', 'DEBT', 'GRANT', 'SUBSIDY', 'LOAN', 'GUARANTEE', 'ANY_SUITABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('ANGEL', 'VENTURE_CAPITAL', 'PRIVATE_EQUITY', 'FAMILY_OFFICE', 'CORPORATE', 'IMPACT', 'FUND', 'OTHER');

-- CreateEnum
CREATE TYPE "SchemeType" AS ENUM ('GRANT', 'LOAN', 'EQUITY', 'SUBSIDY', 'GUARANTEE', 'INCUBATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SchemeLevel" AS ENUM ('CENTRAL', 'STATE');

-- CreateEnum
CREATE TYPE "SchemeStatus" AS ENUM ('DRAFT', 'NEEDS_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'NEEDS_REVERIFICATION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('POTENTIALLY_ELIGIBLE', 'NEEDS_INFORMATION', 'REVIEW_REQUIRED', 'LIKELY_NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACTION_FAILED', 'ANALYSING', 'ANALYSED', 'ANALYSIS_FAILED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('INVESTOR', 'SCHEME');

-- CreateEnum
CREATE TYPE "ShortlistStatus" AS ENUM ('WATCHING', 'CONTACTED', 'IN_REVIEW', 'PASSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('USER', 'OFFICIAL_SOURCE', 'SEED', 'SYNTHETIC', 'IMPORT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'READINESS', 'MATCH', 'PROPOSAL', 'SCHEME', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RagSourceType" AS ENUM ('OFFICIAL_SCHEME_PAGE', 'OFFICIAL_PDF', 'OFFICIAL_GUIDELINE', 'SCHEME_RECORD');

-- CreateEnum
CREATE TYPE "RagDocumentStatus" AS ENUM ('DRAFT', 'NEEDS_VERIFICATION', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" "BusinessType",
    "industry" TEXT,
    "subIndustry" TEXT,
    "location" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "foundedYear" INTEGER,
    "businessStage" "BusinessStage",
    "teamSize" INTEGER,
    "description" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "targetCustomer" TEXT,
    "productStatus" "ProductStatus",
    "customerCount" INTEGER,
    "annualRevenue" DECIMAL(18,2),
    "annualExpenses" DECIMAL(18,2),
    "profitLoss" DECIMAL(18,2),
    "existingFunding" DECIMAL(18,2),
    "existingDebt" DECIMAL(18,2),
    "growthRate" DOUBLE PRECISION,
    "marketSize" DECIMAL(18,2),
    "founderExperience" INTEGER,
    "teamStrength" TEXT,
    "customers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "partnerships" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intellectualProperty" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "udyamRegistered" BOOLEAN,
    "dpiitRecognised" BOOLEAN,
    "gstRegistered" BOOLEAN,
    "registrationNumber" TEXT,
    "discoverable" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" "DataSourceType" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRequirement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountRequired" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "purpose" TEXT NOT NULL,
    "fundingType" "FundingType" NOT NULL,
    "preferredTimeline" TEXT,
    "preferredLocation" TEXT,
    "additionalRequirements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorName" TEXT NOT NULL,
    "investorType" "InvestorType" NOT NULL,
    "description" TEXT,
    "minInvestment" DECIMAL(18,2),
    "maxInvestment" DECIMAL(18,2),
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredStages" "BusinessStage"[] DEFAULT ARRAY[]::"BusinessStage"[],
    "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fundingTypes" "FundingType"[] DEFAULT ARRAY[]::"FundingType"[],
    "investmentPreferences" TEXT,
    "website" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "source" TEXT,
    "sourceType" "DataSourceType" NOT NULL DEFAULT 'USER',
    "lastVerifiedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentScheme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ministry" TEXT,
    "department" TEXT,
    "level" "SchemeLevel" NOT NULL,
    "schemeType" "SchemeType" NOT NULL,
    "targetBusinessTypes" "BusinessType"[] DEFAULT ARRAY[]::"BusinessType"[],
    "supportedIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportedStages" "BusinessStage"[] DEFAULT ARRAY[]::"BusinessStage"[],
    "supportedLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportedFundingTypes" "FundingType"[] DEFAULT ARRAY[]::"FundingType"[],
    "supportedPurposes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minFunding" DECIMAL(18,2),
    "maxFunding" DECIMAL(18,2),
    "fundingDescription" TEXT,
    "description" TEXT,
    "eligibilityRules" JSONB,
    "eligibilityCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicationProcess" TEXT,
    "applicationUrl" TEXT,
    "officialSourceUrl" TEXT NOT NULL,
    "status" "SchemeStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "sourceType" "DataSourceType" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeRevision" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'UPLOADED',
    "statusMessage" TEXT,
    "extractedText" TEXT,
    "sections" JSONB,
    "wordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalAnalysis" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "clarityScore" INTEGER NOT NULL,
    "completenessScore" INTEGER NOT NULL,
    "structureScore" INTEGER NOT NULL,
    "marketEvidenceScore" INTEGER NOT NULL,
    "financialScore" INTEGER NOT NULL,
    "fundingJustificationScore" INTEGER NOT NULL,
    "teamScore" INTEGER NOT NULL,
    "identifiedStrengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identifiedWeaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvementSuggestions" JSONB NOT NULL DEFAULT '[]',
    "llmAssisted" BOOLEAN NOT NULL DEFAULT false,
    "modelVersion" TEXT NOT NULL,
    "configVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingReadiness" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "businessProfileScore" INTEGER NOT NULL,
    "financialScore" INTEGER NOT NULL,
    "marketValidationScore" INTEGER NOT NULL,
    "teamScore" INTEGER NOT NULL,
    "proposalScore" INTEGER NOT NULL,
    "components" JSONB NOT NULL DEFAULT '[]',
    "missingInformation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelVersion" TEXT NOT NULL,
    "configVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorMatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "industryScore" DOUBLE PRECISION NOT NULL,
    "fundingScore" DOUBLE PRECISION NOT NULL,
    "stageScore" DOUBLE PRECISION NOT NULL,
    "locationScore" DOUBLE PRECISION NOT NULL,
    "fundingTypeScore" DOUBLE PRECISION NOT NULL,
    "semanticScore" DOUBLE PRECISION,
    "overallScore" INTEGER NOT NULL,
    "matchedFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explanation" JSONB NOT NULL,
    "narrative" TEXT,
    "modelVersion" TEXT NOT NULL,
    "configVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeMatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "eligibilityScore" INTEGER NOT NULL,
    "businessTypeScore" DOUBLE PRECISION NOT NULL,
    "industryScore" DOUBLE PRECISION NOT NULL,
    "stageScore" DOUBLE PRECISION NOT NULL,
    "locationScore" DOUBLE PRECISION NOT NULL,
    "fundingScore" DOUBLE PRECISION NOT NULL,
    "purposeScore" DOUBLE PRECISION NOT NULL,
    "semanticScore" DOUBLE PRECISION,
    "matchedCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockingIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MatchStatus" NOT NULL,
    "explanation" JSONB NOT NULL,
    "narrative" TEXT,
    "modelVersion" TEXT NOT NULL,
    "configVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityType" "OpportunityType" NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ShortlistStatus" NOT NULL DEFAULT 'WATCHING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlanItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "priority" "ActionPriority" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'TODO',
    "sourceModule" TEXT NOT NULL,
    "sourceKey" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "value" JSONB NOT NULL,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeDocument" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" "RagSourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publisher" TEXT,
    "checksum" TEXT,
    "language" TEXT DEFAULT 'en',
    "status" "RagDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "content" TEXT,
    "wordCount" INTEGER,
    "embeddingModel" TEXT,
    "chunkSize" INTEGER,
    "chunkOverlap" INTEGER,
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeDocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "heading" TEXT,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeDocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "configVersion" TEXT,
    "embeddingModel" TEXT,
    "randomSeed" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hyperparams" JSONB,
    "trainTestSplit" JSONB,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "labelSource" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE INDEX "BusinessProfile_industry_idx" ON "BusinessProfile"("industry");

-- CreateIndex
CREATE INDEX "BusinessProfile_businessStage_idx" ON "BusinessProfile"("businessStage");

-- CreateIndex
CREATE INDEX "BusinessProfile_state_idx" ON "BusinessProfile"("state");

-- CreateIndex
CREATE INDEX "BusinessProfile_discoverable_idx" ON "BusinessProfile"("discoverable");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRequirement_businessId_key" ON "FundingRequirement"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfile_userId_key" ON "InvestorProfile"("userId");

-- CreateIndex
CREATE INDEX "InvestorProfile_investorType_idx" ON "InvestorProfile"("investorType");

-- CreateIndex
CREATE INDEX "InvestorProfile_active_idx" ON "InvestorProfile"("active");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentScheme_slug_key" ON "GovernmentScheme"("slug");

-- CreateIndex
CREATE INDEX "GovernmentScheme_status_idx" ON "GovernmentScheme"("status");

-- CreateIndex
CREATE INDEX "GovernmentScheme_level_idx" ON "GovernmentScheme"("level");

-- CreateIndex
CREATE INDEX "GovernmentScheme_schemeType_idx" ON "GovernmentScheme"("schemeType");

-- CreateIndex
CREATE INDEX "GovernmentScheme_lastVerifiedAt_idx" ON "GovernmentScheme"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "SchemeRevision_schemeId_createdAt_idx" ON "SchemeRevision"("schemeId", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_businessId_createdAt_idx" ON "Proposal"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalAnalysis_proposalId_createdAt_idx" ON "ProposalAnalysis"("proposalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FundingReadiness_businessId_key" ON "FundingReadiness"("businessId");

-- CreateIndex
CREATE INDEX "InvestorMatch_businessId_overallScore_idx" ON "InvestorMatch"("businessId", "overallScore");

-- CreateIndex
CREATE INDEX "InvestorMatch_investorId_overallScore_idx" ON "InvestorMatch"("investorId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorMatch_businessId_investorId_key" ON "InvestorMatch"("businessId", "investorId");

-- CreateIndex
CREATE INDEX "SchemeMatch_businessId_eligibilityScore_idx" ON "SchemeMatch"("businessId", "eligibilityScore");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeMatch_businessId_schemeId_key" ON "SchemeMatch"("businessId", "schemeId");

-- CreateIndex
CREATE INDEX "SavedOpportunity_userId_idx" ON "SavedOpportunity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_opportunityType_opportunityId_key" ON "SavedOpportunity"("userId", "opportunityType", "opportunityId");

-- CreateIndex
CREATE INDEX "Shortlist_investorId_idx" ON "Shortlist"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "Shortlist_investorId_businessId_key" ON "Shortlist"("investorId", "businessId");

-- CreateIndex
CREATE INDEX "ActionPlanItem_businessId_priority_idx" ON "ActionPlanItem"("businessId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ActionPlanItem_businessId_sourceKey_key" ON "ActionPlanItem"("businessId", "sourceKey");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "MatchingConfig_key_active_idx" ON "MatchingConfig"("key", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MatchingConfig_key_version_key" ON "MatchingConfig"("key", "version");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SchemeDocument_schemeId_idx" ON "SchemeDocument"("schemeId");

-- CreateIndex
CREATE INDEX "SchemeDocument_status_idx" ON "SchemeDocument"("status");

-- CreateIndex
CREATE INDEX "SchemeDocument_sourceType_idx" ON "SchemeDocument"("sourceType");

-- CreateIndex
CREATE INDEX "SchemeDocumentChunk_documentId_idx" ON "SchemeDocumentChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeDocumentChunk_documentId_chunkIndex_key" ON "SchemeDocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ExperimentRun_name_startedAt_idx" ON "ExperimentRun"("name", "startedAt");

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRequirement" ADD CONSTRAINT "FundingRequirement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfile" ADD CONSTRAINT "InvestorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeRevision" ADD CONSTRAINT "SchemeRevision_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "GovernmentScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalAnalysis" ADD CONSTRAINT "ProposalAnalysis_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingReadiness" ADD CONSTRAINT "FundingReadiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMatch" ADD CONSTRAINT "InvestorMatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMatch" ADD CONSTRAINT "InvestorMatch_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeMatch" ADD CONSTRAINT "SchemeMatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeMatch" ADD CONSTRAINT "SchemeMatch_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "GovernmentScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlanItem" ADD CONSTRAINT "ActionPlanItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeDocument" ADD CONSTRAINT "SchemeDocument_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "GovernmentScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeDocumentChunk" ADD CONSTRAINT "SchemeDocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SchemeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
