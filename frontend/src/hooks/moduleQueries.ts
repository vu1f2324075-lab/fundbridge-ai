/**
 * Server-state hooks for the proposal, investor and admin modules.
 *
 * Invalidation is explicit about cross-module effects. A proposal analysis
 * changes the readiness score (the backend clears the stored row), and a scheme
 * status change alters both the public catalogue and the RAG index — so those
 * caches are invalidated too rather than left to go stale.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiRequestWithMeta, ApiError } from '../lib/api';
import { queryKeys } from './queries';
import type {
  AdminScheme,
  AdminUser,
  AuditLogEntry,
  DataQualityReport,
  DiscoverableBusiness,
  InvestorDashboard,
  InvestorMatch,
  InvestorProfile,
  MatchingConfigEntry,
  PageMeta,
  Proposal,
  RagAnswer,
  RagIndexStats,
  SchemeRevision,
  SchemeStatus,
  SectionSuggestion,
  SecurityOverview,
  ShortlistEntry,
  ShortlistStatus,
  SystemStatus,
  UploadResult,
} from '../types/modules';

export const moduleKeys = {
  proposals: ['proposals'] as const,
  proposal: (id: string) => ['proposals', id] as const,

  investorDashboard: ['investor', 'dashboard'] as const,
  investorProfile: ['investor', 'profile'] as const,
  investorMatches: ['investor', 'matches'] as const,
  investorShortlist: ['investor', 'shortlist'] as const,
  discover: (p: Record<string, unknown>) => ['investor', 'discover', p] as const,
  discoverBusiness: (id: string) => ['investor', 'business', id] as const,

  adminStatus: ['admin', 'status'] as const,
  adminQuality: ['admin', 'quality'] as const,
  adminSecurity: ['admin', 'security'] as const,
  adminSchemes: (p: Record<string, unknown>) => ['admin', 'schemes', p] as const,
  adminScheme: (id: string) => ['admin', 'scheme', id] as const,
  adminRevisions: (id: string) => ['admin', 'scheme', id, 'revisions'] as const,
  adminUsers: (p: Record<string, unknown>) => ['admin', 'users', p] as const,
  adminConfig: ['admin', 'config'] as const,
  adminRag: ['admin', 'rag'] as const,
  adminAudit: (p: Record<string, unknown>) => ['admin', 'audit', p] as const,
};

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export function useProposals() {
  return useQuery({
    queryKey: moduleKeys.proposals,
    queryFn: () => api.get<{ proposals: Proposal[] }>('/proposals'),
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: moduleKeys.proposal(id),
    queryFn: () => api.get<{ proposal: Proposal }>(`/proposals/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * Uploads a proposal.
 *
 * Uses `fetch` directly rather than the JSON client: the body is multipart, so
 * the Content-Type must be left for the browser to set with its boundary.
 */
export function useUploadProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);

      const csrf = /(?:^|;\s*)fb_csrf=([^;]+)/.exec(document.cookie)?.[1];
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';

      const response = await fetch(`${base}/proposals/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {},
        body: form,
      });

      const text = await response.text();
      const payload = text ? (JSON.parse(text) as { data?: { proposal: UploadResult }; error?: { code?: string; message?: string } }) : null;

      if (!response.ok) {
        throw new ApiError({
          code: (payload?.error?.code as never) ?? 'INTERNAL_ERROR',
          message: payload?.error?.message ?? 'The upload failed.',
          status: response.status,
        });
      }
      return payload!.data!.proposal;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.proposals });
      // A new analysis changes the proposal-quality readiness component, and the
      // backend clears the stored readiness row.
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      void qc.invalidateQueries({ queryKey: queryKeys.actionPlan });
    },
  });
}

export function useAnalyseProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ result: { status: string; message: string | null } }>(`/proposals/${id}/analyse`),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: moduleKeys.proposal(id) });
      void qc.invalidateQueries({ queryKey: moduleKeys.proposals });
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useExtractProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ result: { status: string; message: string | null } }>(`/proposals/${id}/extract`),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: moduleKeys.proposal(id) });
      void qc.invalidateQueries({ queryKey: moduleKeys.proposals });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/proposals/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.proposals });
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSuggestSection() {
  return useMutation({
    mutationFn: (input: { section: string; currentText?: string | null }) =>
      api.post<{ suggestion: SectionSuggestion }>('/assistant/section', input),
  });
}

export function useAskSchemes() {
  return useMutation({
    mutationFn: (input: { question: string; schemeId?: string }) =>
      api.post<{ answer: RagAnswer }>('/assistant/ask', input),
  });
}

// ---------------------------------------------------------------------------
// Investor
// ---------------------------------------------------------------------------

export function useInvestorDashboard() {
  return useQuery({
    queryKey: moduleKeys.investorDashboard,
    queryFn: () => api.get<{ dashboard: InvestorDashboard }>('/investor/dashboard'),
  });
}

export function useInvestorProfile() {
  return useQuery({
    queryKey: moduleKeys.investorProfile,
    queryFn: () => api.get<{ investor: InvestorProfile }>('/investor/profile'),
  });
}

export function useUpdateInvestorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<InvestorProfile>) =>
      api.put<{ investor: InvestorProfile }>('/investor/profile', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.investorProfile });
      // Preferences changed, so the backend deleted the stored matches.
      void qc.invalidateQueries({ queryKey: moduleKeys.investorMatches });
      void qc.invalidateQueries({ queryKey: moduleKeys.investorDashboard });
    },
  });
}

export function useDiscoverBusinesses(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: moduleKeys.discover(params),
    queryFn: () =>
      apiRequestWithMeta<DiscoverableBusiness[], PageMeta>('/investor/discover', {
        method: 'GET',
        query: params,
      }),
  });
}

export function useDiscoverableBusiness(id: string) {
  return useQuery({
    queryKey: moduleKeys.discoverBusiness(id),
    queryFn: () => api.get<{ business: DiscoverableBusiness }>(`/investor/businesses/${id}`),
    enabled: Boolean(id),
  });
}

export function useInvestorMatches() {
  return useQuery({
    queryKey: moduleKeys.investorMatches,
    queryFn: () => api.get<{ matches: InvestorMatch[] }>('/investor/matches'),
  });
}

export function useRecalculateInvestorMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ summary: { evaluated: number; stored: number }; matches: InvestorMatch[] }>(
        '/investor/matches/recalculate',
      ),
    onSuccess: ({ matches }) => {
      qc.setQueryData(moduleKeys.investorMatches, { matches });
      void qc.invalidateQueries({ queryKey: moduleKeys.investorDashboard });
    },
  });
}

export function useShortlist() {
  return useQuery({
    queryKey: moduleKeys.investorShortlist,
    queryFn: () => api.get<{ shortlist: ShortlistEntry[] }>('/investor/shortlist'),
  });
}

export function useAddToShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { businessId: string; notes?: string | null }) =>
      api.post<{ entry: ShortlistEntry }>('/investor/shortlist', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.investorShortlist });
      void qc.invalidateQueries({ queryKey: moduleKeys.investorDashboard });
    },
  });
}

export function useUpdateShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: ShortlistStatus; notes?: string | null }) =>
      api.patch<{ entry: ShortlistEntry }>(`/investor/shortlist/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: moduleKeys.investorShortlist }),
  });
}

export function useRemoveFromShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investor/shortlist/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.investorShortlist });
      void qc.invalidateQueries({ queryKey: moduleKeys.investorDashboard });
    },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function useSystemStatus() {
  return useQuery({
    queryKey: moduleKeys.adminStatus,
    queryFn: () => api.get<{ status: SystemStatus }>('/admin/status'),
    // The AI-service probe is a live network call; refresh it periodically so
    // the screen reflects reality rather than a cached optimism.
    refetchInterval: 30_000,
  });
}

export function useDataQuality() {
  return useQuery({
    queryKey: moduleKeys.adminQuality,
    queryFn: () => api.get<{ report: DataQualityReport }>('/admin/data-quality'),
  });
}

export function useSecurityOverview() {
  return useQuery({
    queryKey: moduleKeys.adminSecurity,
    queryFn: () => api.get<{ overview: SecurityOverview }>('/admin/security'),
  });
}

export function useAdminSchemes(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: moduleKeys.adminSchemes(params),
    queryFn: () =>
      apiRequestWithMeta<AdminScheme[], PageMeta>('/admin/schemes', { method: 'GET', query: params }),
  });
}

export function useAdminScheme(id: string) {
  return useQuery({
    queryKey: moduleKeys.adminScheme(id),
    queryFn: () =>
      api.get<{ scheme: AdminScheme & { revisions: SchemeRevision[]; documents: unknown[] } }>(
        `/admin/schemes/${id}`,
      ),
    enabled: Boolean(id),
  });
}

export function useTransitionScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: SchemeStatus; reason?: string }) =>
      api.post<{ scheme: AdminScheme; indexNote: string | null }>(`/admin/schemes/${id}/transition`, {
        status,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: moduleKeys.adminScheme(id) });
      void qc.invalidateQueries({ queryKey: ['admin', 'schemes'] });
      void qc.invalidateQueries({ queryKey: moduleKeys.adminQuality });
      // Publishing or archiving changes both the public catalogue and the RAG
      // index.
      void qc.invalidateQueries({ queryKey: moduleKeys.adminRag });
      void qc.invalidateQueries({ queryKey: ['schemes'] });
    },
  });
}

export function useUpdateScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.put<{ scheme: AdminScheme }>(`/admin/schemes/${id}`, body),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: moduleKeys.adminScheme(id) });
      void qc.invalidateQueries({ queryKey: ['admin', 'schemes'] });
      void qc.invalidateQueries({ queryKey: ['schemes'] });
    },
  });
}

export function useSchemeRevisions(id: string) {
  return useQuery({
    queryKey: moduleKeys.adminRevisions(id),
    queryFn: () => api.get<{ revisions: SchemeRevision[] }>(`/admin/schemes/${id}/revisions`),
    enabled: Boolean(id),
  });
}

export function useAdminUsers(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: moduleKeys.adminUsers(params),
    queryFn: () => apiRequestWithMeta<AdminUser[], PageMeta>('/admin/users', { method: 'GET', query: params }),
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      api.post<{ user: AdminUser }>(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: moduleKeys.adminSecurity });
    },
  });
}

export function useMatchingConfig() {
  return useQuery({
    queryKey: moduleKeys.adminConfig,
    queryFn: () => api.get<{ config: MatchingConfigEntry[] }>('/admin/matching-config'),
  });
}

export function useUpdateMatchingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: unknown; notes?: string }) =>
      api.put<{ config: MatchingConfigEntry }>('/admin/matching-config', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.adminConfig });
      // Stored scores were computed with the previous weights.
      void qc.invalidateQueries({ queryKey: queryKeys.matches });
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
    },
  });
}

export function useRagStats() {
  return useQuery({
    queryKey: moduleKeys.adminRag,
    queryFn: () => api.get<{ stats: RagIndexStats }>('/admin/rag/stats'),
  });
}

export function useReindexRag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{
        result: {
          schemes: number;
          indexed: number;
          chunks: number;
          failures: Array<{ schemeId: string; reason: string }>;
        };
      }>('/admin/rag/reindex'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.adminRag });
      void qc.invalidateQueries({ queryKey: moduleKeys.adminStatus });
    },
  });
}

export function useClearRagIndex() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ result: { deletedChunks: number } }>('/admin/rag/clear'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleKeys.adminRag });
      void qc.invalidateQueries({ queryKey: moduleKeys.adminStatus });
    },
  });
}

export function useAuditLogs(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: moduleKeys.adminAudit(params),
    queryFn: () =>
      apiRequestWithMeta<AuditLogEntry[], PageMeta>('/admin/audit-logs', { method: 'GET', query: params }),
  });
}
