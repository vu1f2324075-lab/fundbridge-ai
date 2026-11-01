/**
 * Match-status presentation.
 *
 * Labels are deliberately non-committal. None of them says "eligible",
 * "approved" or "guaranteed" — the system reports potential relevance, and the
 * vocabulary has to hold that line even in a badge.
 *
 * LIKELY_NOT_ELIGIBLE is shown as a neutral grey rather than red: it is useful
 * information that saves the user time, not a failure on their part.
 */
import type { FactorOutcome, MatchStatus } from '../../types/api';

export const STATUS_LABEL: Record<MatchStatus, string> = {
  POTENTIALLY_ELIGIBLE: 'Potentially eligible',
  NEEDS_INFORMATION: 'Needs information',
  REVIEW_REQUIRED: 'Review required',
  LIKELY_NOT_ELIGIBLE: 'Likely not eligible',
};

export const STATUS_TONE: Record<MatchStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  POTENTIALLY_ELIGIBLE: 'success',
  NEEDS_INFORMATION: 'warning',
  REVIEW_REQUIRED: 'info',
  LIKELY_NOT_ELIGIBLE: 'neutral',
};

export const STATUS_EXPLANATION: Record<MatchStatus, string> = {
  POTENTIALLY_ELIGIBLE:
    'Your profile satisfies the criteria on record with no blocking issues. Verify current requirements with the official source before applying.',
  NEEDS_INFORMATION:
    'Some criteria could not be assessed because information is missing from your profile. The score shown is a floor and may rise once you provide it.',
  REVIEW_REQUIRED:
    'Some criteria did not match. This scheme may still be worth reviewing, but read the factor breakdown first.',
  LIKELY_NOT_ELIGIBLE:
    'This scheme states a condition your profile does not meet. The blocking issue below explains which one.',
};

export const OUTCOME_LABEL: Record<FactorOutcome, string> = {
  MATCH: 'Matched',
  MISMATCH: 'Did not match',
  UNRESTRICTED: 'Not restricted',
  UNKNOWN: 'Not provided',
};

export const OUTCOME_TONE: Record<FactorOutcome, 'success' | 'danger' | 'neutral' | 'warning'> = {
  MATCH: 'success',
  MISMATCH: 'danger',
  // Not a match in the user's favour so much as an absence of constraint —
  // shown neutrally so it is not mistaken for evidence of a good fit.
  UNRESTRICTED: 'neutral',
  UNKNOWN: 'warning',
};
