/**
 * Server-state hooks.
 *
 * All API data flows through TanStack Query rather than component state, so
 * loading and error states are uniform and a mutation can invalidate exactly
 * what it affected.
 *
 * The invalidation map matters here: recalculating readiness changes the
 * dashboard, and editing the profile invalidates readiness *and* matches,
 * because the backend deletes derived analysis when inputs change. Getting this
 * wrong would leave the UI showing a score the server has already discarded.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiRequestWithMeta } from '../lib/api';
import type {
  ActionItem,
  BusinessProfile,
  Dashboard,
  FundingRequirement,
  Meta,
  Readiness,
  SavedOpportunity,
  Scheme,
  SchemeMatch,
} from '../types/api';

export const queryKeys = {
  meta: ['meta'] as const,
  dashboard: ['dashboard'] as const,
  profile: ['business', 'profile'] as const,
  completion: ['business', 'completion'] as const,
  requirement: ['business', 'requirement'] as const,
  readiness: ['business', 'readiness'] as const,
  matches: ['business', 'matches'] as const,
  match: (id: string) => ['business', 'matches', id] as const,
  schemes: (params: Record<string, unknown>) => ['schemes', params] as const,
  scheme: (id: string) => ['schemes', id] as const,
  actionPlan: ['business', 'action-plan'] as const,
  saved: ['saved'] as const,
};

/** Static for a session: vocabularies and feature flags do not change. */
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: () => api.get<Meta>('/meta'),
    staleTime: Infinity,
  });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.get<{ dashboard: Dashboard }>('/business/dashboard') });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.get<{ business: BusinessProfile }>('/business/profile'),
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: queryKeys.readiness,
    queryFn: () => api.get<{ readiness: Readiness | null }>('/business/readiness'),
  });
}

export function useSchemeMatches() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: () => api.get<{ matches: SchemeMatch[] }>('/business/matches/schemes'),
  });
}

export function useSchemeMatch(schemeId: string) {
  return useQuery({
    queryKey: queryKeys.match(schemeId),
    queryFn: () => api.get<{ match: SchemeMatch }>(`/business/matches/schemes/${schemeId}`),
    enabled: Boolean(schemeId),
  });
}

export function useSchemes(params: { page?: number; search?: string; level?: string; schemeType?: string }) {
  return useQuery({
    queryKey: queryKeys.schemes(params),
    queryFn: () =>
      apiRequestWithMeta<Scheme[], { page: number; limit: number; total: number; totalPages: number }>('/schemes', {
        method: 'GET',
        query: params,
      }),
  });
}

export function useScheme(id: string) {
  return useQuery({
    queryKey: queryKeys.scheme(id),
    queryFn: () => api.get<{ scheme: Scheme }>(`/schemes/${id}`),
    enabled: Boolean(id),
  });
}

export function useActionPlan() {
  return useQuery({
    queryKey: queryKeys.actionPlan,
    queryFn: () => api.get<{ items: ActionItem[] }>('/business/action-plan'),
  });
}

export function useSaved() {
  return useQuery({ queryKey: queryKeys.saved, queryFn: () => api.get<{ saved: SavedOpportunity[] }>('/saved') });
}

// --- Mutations -------------------------------------------------------------

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BusinessProfile>) =>
      api.put<{ business: BusinessProfile }>('/business/profile', input),
    onSuccess: () => {
      // The backend deletes derived analysis when inputs change, so these must
      // be refetched — otherwise the UI shows a score the server discarded.
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
      void qc.invalidateQueries({ queryKey: queryKeys.completion });
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.matches });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSaveRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<FundingRequirement, 'id'>) =>
      api.put<{ requirement: FundingRequirement }>('/business/funding-requirement', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.requirement });
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
      void qc.invalidateQueries({ queryKey: queryKeys.readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.matches });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useAnalyseReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ readiness: Readiness }>('/business/readiness/analyse'),
    onSuccess: ({ readiness }) => {
      // Seed the cache from the response so the page updates without a refetch.
      qc.setQueryData(queryKeys.readiness, { readiness });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      // Readiness findings feed the action plan.
      void qc.invalidateQueries({ queryKey: queryKeys.actionPlan });
    },
  });
}

export function useRecalculateMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ summary: { evaluated: number; stored: number; semanticAvailable: boolean }; matches: SchemeMatch[] }>(
        '/business/matches/schemes/recalculate',
      ),
    onSuccess: ({ matches }) => {
      qc.setQueryData(queryKeys.matches, { matches });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      void qc.invalidateQueries({ queryKey: queryKeys.actionPlan });
    },
  });
}

export function useGenerateActionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ summary: { created: number; updated: number; removed: number }; items: ActionItem[] }>(
        '/business/action-plan/generate',
      ),
    onSuccess: ({ items }) => {
      qc.setQueryData(queryKeys.actionPlan, { items });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionItem['status'] }) =>
      api.patch<{ item: ActionItem }>(`/business/action-plan/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.actionPlan });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSaveOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { opportunityType: 'SCHEME' | 'INVESTOR'; opportunityId: string; notes?: string }) =>
      api.post<{ saved: SavedOpportunity }>('/saved', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.saved });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/saved/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.saved });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
