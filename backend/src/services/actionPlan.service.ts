/**
 * Action plan generation.
 *
 * Every generated item traces to a specific finding from readiness, proposal
 * analysis, or scheme matching. There is no generic encouragement and no filler
 * (master spec §21: "Do NOT generate generic filler actions").
 *
 * Items carry a `sourceKey` so regeneration *updates* the matching item instead
 * of duplicating it, and so a user's manual items are never overwritten. An
 * item the user has completed or dismissed is left alone even if the underlying
 * finding persists — their decision stands.
 */
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { serialize } from '../lib/serialize';
import { STATUS_LABELS } from '../engines/schemeMatching.engine';
import type { ActionPriority, Prisma } from '../../generated/prisma';

interface GeneratedItem {
  sourceKey: string;
  sourceModule: 'READINESS' | 'PROPOSAL' | 'SCHEME_MATCH' | 'INVESTOR_MATCH';
  title: string;
  description: string;
  reason: string;
  priority: ActionPriority;
}

/** Readiness components below this are worth acting on. */
const WEAK_COMPONENT_THRESHOLD = 75;

/**
 * Priority from how much overall score the gap is costing.
 *
 * A weak component carrying a large weight is a bigger opportunity than a very
 * weak one carrying a small weight, so priority follows lost points rather than
 * the raw score.
 */
function priorityFromLostPoints(lost: number): ActionPriority {
  if (lost >= 15) return 'P1';
  if (lost >= 10) return 'P2';
  if (lost >= 5) return 'P3';
  return 'P4';
}

interface ReadinessComponentRow {
  key: string;
  name: string;
  score: number;
  weight: number;
  missing: string[];
}

function fromReadiness(components: ReadinessComponentRow[]): GeneratedItem[] {
  return components
    .filter((c) => c.score < WEAK_COMPONENT_THRESHOLD && c.missing.length > 0)
    .map((c) => {
      const lostPoints = (100 - c.score) * c.weight;
      return {
        sourceKey: `readiness:${c.key}`,
        sourceModule: 'READINESS' as const,
        title: `Complete your ${c.name.toLowerCase()}`,
        description: `Add the following: ${c.missing.slice(0, 5).join('; ')}.`,
        reason:
          `Your ${c.name} component scored ${c.score}/100. It carries ` +
          `${Math.round(c.weight * 100)}% of your readiness score, so completing it could add up to ` +
          `${Math.round(lostPoints)} points.`,
        priority: priorityFromLostPoints(lostPoints),
      };
    });
}

interface SchemeMatchRow {
  schemeId: string;
  status: string;
  eligibilityScore: number;
  missingCriteria: string[];
  blockingIssues: string[];
  scheme: { name: string; applicationUrl: string | null; officialSourceUrl: string };
}

function fromSchemeMatches(matches: SchemeMatchRow[]): GeneratedItem[] {
  const items: GeneratedItem[] = [];

  for (const m of matches) {
    // A match held back only by unanswered questions is the most actionable
    // kind: the user can resolve it themselves.
    if (m.status === 'NEEDS_INFORMATION' && m.missingCriteria.length > 0) {
      items.push({
        sourceKey: `scheme:${m.schemeId}:missing-info`,
        sourceModule: 'SCHEME_MATCH',
        title: `Provide missing details for ${m.scheme.name}`,
        description: m.missingCriteria.slice(0, 4).join(' '),
        reason:
          `This scheme scored ${m.eligibilityScore}/100 on the criteria that could be checked, but some ` +
          `required information is missing, so its status is "${STATUS_LABELS.NEEDS_INFORMATION}". ` +
          `The score shown is a floor and may rise once you provide these details.`,
        priority: m.eligibilityScore >= 70 ? 'P1' : 'P2',
      });
    }

    // Verification is a real task even for a strong match — FundBridge is not
    // the authority on current eligibility.
    if (m.status === 'POTENTIALLY_ELIGIBLE') {
      items.push({
        sourceKey: `scheme:${m.schemeId}:verify`,
        sourceModule: 'SCHEME_MATCH',
        title: `Verify eligibility for ${m.scheme.name}`,
        description: `Confirm the current requirements at the official source: ${m.scheme.applicationUrl ?? m.scheme.officialSourceUrl}`,
        reason:
          `This scheme matched ${m.eligibilityScore}/100 of the criteria on record with no blocking issues. ` +
          `Scheme terms change, so confirm the current requirements with the official source before applying.`,
        priority: 'P2',
      });
    }
  }

  return items;
}

interface ProposalAnalysisRow {
  proposalId: string;
  overallScore: number;
  missingSections: string[];
  improvementSuggestions: unknown;
}

function fromProposalAnalysis(analysis: ProposalAnalysisRow | null): GeneratedItem[] {
  if (!analysis) return [];
  const items: GeneratedItem[] = [];

  if (analysis.missingSections.length > 0) {
    items.push({
      sourceKey: `proposal:${analysis.proposalId}:missing-sections`,
      sourceModule: 'PROPOSAL',
      title: 'Add the missing sections to your proposal',
      description: `Your proposal appears to be missing: ${analysis.missingSections.slice(0, 6).join(', ')}.`,
      reason: `Proposal analysis scored ${analysis.overallScore}/100 and did not find these sections.`,
      priority: 'P1',
    });
  }

  // The suggestion list is validated JSON from the analysis step; read
  // defensively because it is stored as Json.
  const suggestions = Array.isArray(analysis.improvementSuggestions) ? analysis.improvementSuggestions : [];
  for (const [index, raw] of suggestions.slice(0, 5).entries()) {
    if (typeof raw !== 'object' || raw === null) continue;
    const s = raw as { area?: unknown; issue?: unknown; suggestion?: unknown; severity?: unknown };
    if (typeof s.suggestion !== 'string') continue;

    items.push({
      sourceKey: `proposal:${analysis.proposalId}:suggestion-${index}`,
      sourceModule: 'PROPOSAL',
      title: typeof s.area === 'string' ? `Improve: ${s.area}` : 'Improve your proposal',
      description: s.suggestion,
      reason: typeof s.issue === 'string' ? s.issue : 'Identified by proposal analysis.',
      priority: s.severity === 'HIGH' ? 'P1' : s.severity === 'LOW' ? 'P4' : 'P3',
    });
  }

  return items;
}

/**
 * Regenerates the plan from current findings.
 *
 * Returns counts so the UI can report what changed rather than silently
 * refreshing the list.
 */
export async function regenerateActionPlan(businessId: string): Promise<{
  created: number;
  updated: number;
  removed: number;
  preserved: number;
}> {
  const [readiness, matches, latestProposal] = await Promise.all([
    prisma.fundingReadiness.findUnique({ where: { businessId } }),
    prisma.schemeMatch.findMany({
      where: { businessId },
      orderBy: { eligibilityScore: 'desc' },
      take: 10,
      include: { scheme: { select: { name: true, applicationUrl: true, officialSourceUrl: true } } },
    }),
    prisma.proposal.findFirst({
      where: { businessId, status: 'ANALYSED' },
      orderBy: { createdAt: 'desc' },
      include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
  ]);

  const components = Array.isArray(readiness?.components)
    ? (readiness.components as unknown as ReadinessComponentRow[])
    : [];

  const analysis = latestProposal?.analyses[0]
    ? {
        proposalId: latestProposal.id,
        overallScore: latestProposal.analyses[0].overallScore,
        missingSections: latestProposal.analyses[0].missingSections,
        improvementSuggestions: latestProposal.analyses[0].improvementSuggestions,
      }
    : null;

  const generated = [
    ...fromReadiness(components),
    ...fromProposalAnalysis(analysis),
    ...fromSchemeMatches(matches as unknown as SchemeMatchRow[]),
  ];

  const existing = await prisma.actionPlanItem.findMany({
    where: { businessId, sourceModule: { not: 'MANUAL' } },
    select: { id: true, sourceKey: true, status: true },
  });

  const generatedKeys = new Set(generated.map((g) => g.sourceKey));

  // A finding the user has already acted on stays acted on. Re-opening a
  // completed task because the underlying data has not changed would be wrong.
  const settled = new Set(
    existing.filter((e) => e.status === 'COMPLETED' || e.status === 'DISMISSED').map((e) => e.sourceKey ?? ''),
  );

  const toWrite = generated.filter((g) => !settled.has(g.sourceKey));
  const existingKeys = new Set(existing.map((e) => e.sourceKey ?? ''));

  const stale = existing.filter((e) => e.sourceKey && !generatedKeys.has(e.sourceKey) && !settled.has(e.sourceKey));

  await prisma.$transaction([
    // Findings that no longer hold: remove the task rather than leaving advice
    // that no longer applies.
    prisma.actionPlanItem.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } }),
    ...toWrite.map((g) => {
      const data = {
        title: g.title,
        description: g.description,
        reason: g.reason,
        priority: g.priority,
        sourceModule: g.sourceModule,
      } satisfies Prisma.ActionPlanItemUpdateInput;

      return prisma.actionPlanItem.upsert({
        where: { businessId_sourceKey: { businessId, sourceKey: g.sourceKey } },
        // Status is not in `data`, so an in-progress item keeps its status.
        update: data,
        create: { businessId, sourceKey: g.sourceKey, ...data },
      });
    }),
  ]);

  return {
    created: toWrite.filter((g) => !existingKeys.has(g.sourceKey)).length,
    updated: toWrite.filter((g) => existingKeys.has(g.sourceKey)).length,
    removed: stale.length,
    preserved: settled.size,
  };
}

export async function listActionPlan(businessId: string) {
  const items = await prisma.actionPlanItem.findMany({
    where: { businessId },
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
  });
  return serialize(items);
}

export async function updateActionItem(
  businessId: string,
  itemId: string,
  input: { status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED'; notes?: string | null },
) {
  // Scoped by businessId as well as id, so one business cannot update another's
  // item even with a valid item id.
  const existing = await prisma.actionPlanItem.findFirst({
    where: { id: itemId, businessId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Action item');

  const data: Prisma.ActionPlanItemUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.description = input.notes;

  return serialize(await prisma.actionPlanItem.update({ where: { id: itemId }, data }));
}

export async function createManualActionItem(
  businessId: string,
  input: { title: string; description?: string | null; priority: ActionPriority; dueDate?: Date | null },
) {
  return serialize(
    await prisma.actionPlanItem.create({
      data: {
        businessId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        // Marks it as the user's own, so regeneration never touches it.
        sourceModule: 'MANUAL',
        reason: 'Added by you.',
      },
    }),
  );
}

export async function deleteActionItem(businessId: string, itemId: string): Promise<void> {
  const result = await prisma.actionPlanItem.deleteMany({ where: { id: itemId, businessId } });
  if (result.count === 0) throw new NotFoundError('Action item');
}
