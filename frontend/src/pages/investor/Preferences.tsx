/**
 * Investor preferences.
 *
 * `verification` is deliberately absent from this form: an investor cannot mark
 * themselves verified. Only an administrator can, and the backend schema rejects
 * the field.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  FieldError,
  LoadingPanel,
  PageHeader,
} from '../../components/ui';
import { useMeta } from '../../hooks/queries';
import { useInvestorProfile, useUpdateInvestorProfile } from '../../hooks/moduleQueries';
import { ApiError } from '../../lib/api';
import { formatCurrency, humanise } from '../../utils/format';

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';
const labelClass = 'block text-[13px] font-medium text-ink mb-1.5';

const INVESTOR_TYPES = [
  'ANGEL',
  'VENTURE_CAPITAL',
  'PRIVATE_EQUITY',
  'FAMILY_OFFICE',
  'CORPORATE',
  'IMPACT',
  'FUND',
  'OTHER',
] as const;

const STAGES = ['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE'] as const;
const FUNDING_TYPES = ['EQUITY', 'DEBT', 'GRANT', 'SUBSIDY', 'LOAN', 'GUARANTEE', 'ANY_SUITABLE', 'OTHER'] as const;

interface FormValues {
  investorName: string;
  investorType: string;
  description: string;
  minInvestment: string;
  maxInvestment: string;
  industries: string;
  preferredLocations: string;
  investmentPreferences: string;
  website: string;
  active: boolean;
}

function toList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function InvestorPreferencesPage() {
  const { data, isLoading, isError, error, refetch } = useInvestorProfile();
  const { data: meta } = useMeta();
  const update = useUpdateInvestorProfile();

  const [stages, setStages] = useState<string[]>([]);
  const [fundingTypes, setFundingTypes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState } = useForm<FormValues>();
  const investor = data?.investor;

  useEffect(() => {
    if (!investor) return;
    reset({
      investorName: investor.investorName,
      investorType: investor.investorType,
      description: investor.description ?? '',
      minInvestment: investor.minInvestment?.toString() ?? '',
      maxInvestment: investor.maxInvestment?.toString() ?? '',
      industries: investor.industries.join(', '),
      preferredLocations: investor.preferredLocations.join(', '),
      investmentPreferences: investor.investmentPreferences ?? '',
      website: investor.website ?? '',
      active: investor.active,
    });
    setStages(investor.preferredStages);
    setFundingTypes(investor.fundingTypes);
  }, [investor, reset]);

  const minPreview = Number(watch('minInvestment'));
  const maxPreview = Number(watch('maxInvestment'));

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSaved(false);

    const min = toNumberOrNull(values.minInvestment);
    const max = toNumberOrNull(values.maxInvestment);
    if (min !== null && max !== null && min > max) {
      setFormError('Maximum investment must be at least the minimum.');
      return;
    }

    try {
      await update.mutateAsync({
        investorName: values.investorName.trim(),
        investorType: values.investorType,
        description: values.description.trim() || null,
        minInvestment: min,
        maxInvestment: max,
        industries: toList(values.industries),
        preferredStages: stages,
        preferredLocations: toList(values.preferredLocations),
        fundingTypes,
        investmentPreferences: values.investmentPreferences.trim() || null,
        website: values.website.trim() || null,
        active: values.active,
      } as never);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save your preferences.');
    }
  };

  if (isLoading) return <LoadingPanel label="Loading your preferences…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your preferences.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title="Investment preferences"
        description="These drive your matching. A preference you leave blank is scored neutrally rather than as a match, so stating more produces better-differentiated results."
        action={
          <Button type="submit" loading={formState.isSubmitting || update.isPending}>
            Save
          </Button>
        }
      />

      {saved && (
        <div className="mb-5 bg-success-bg border border-success/25 rounded-lg px-4 py-2.5" role="status">
          <p className="text-[13px] text-ink">
            Saved. Your stored matches were cleared because they were computed against the previous preferences —
            recalculate them from the Matches page.
          </p>
        </div>
      )}

      {formError && (
        <div className="mb-5">
          <ErrorPanel message={formError} />
        </div>
      )}

      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader title="Who you are" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="investorName">
                Investor or firm name
              </label>
              <input
                id="investorName"
                {...register('investorName', { required: 'Enter a name' })}
                className={inputClass}
              />
              <FieldError message={formState.errors.investorName?.message} />
            </div>
            <div>
              <label className={labelClass} htmlFor="investorType">
                Investor type
              </label>
              <select id="investorType" {...register('investorType')} className={inputClass}>
                {INVESTOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanise(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="description">
                About you
              </label>
              <textarea id="description" rows={3} {...register('description')} className={`${inputClass} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="website">
                Website
              </label>
              <input id="website" type="url" {...register('website')} className={inputClass} placeholder="https://" />
            </div>
          </div>

          {investor && (
            <div className="mt-4 pt-3 border-t border-line flex items-center gap-2">
              <Badge tone={investor.verification === 'VERIFIED' ? 'success' : 'neutral'}>
                {humanise(investor.verification)}
              </Badge>
              <span className="text-[12px] text-ink-soft">
                Verification is set by an administrator, not self-assigned.
              </span>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Investment range"
            description="Used to score cheque-size fit against each business's stated requirement."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="minInvestment">
                Minimum (₹)
              </label>
              <input
                id="minInvestment"
                type="number"
                step="any"
                {...register('minInvestment')}
                className={inputClass}
              />
              {Number.isFinite(minPreview) && minPreview > 0 && (
                <p className="text-[12px] text-ink-soft mt-1">{formatCurrency(minPreview)}</p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="maxInvestment">
                Maximum (₹)
              </label>
              <input
                id="maxInvestment"
                type="number"
                step="any"
                {...register('maxInvestment')}
                className={inputClass}
              />
              {Number.isFinite(maxPreview) && maxPreview > 0 && (
                <p className="text-[12px] text-ink-soft mt-1">{formatCurrency(maxPreview)}</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="What you invest in" description="Comma-separate industries and locations." />
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="industries">
                Industries
              </label>
              <input
                id="industries"
                list="industry-options"
                {...register('industries')}
                className={inputClass}
                placeholder="Technology, Manufacturing"
              />
              <datalist id="industry-options">
                {meta?.vocabularies.industries.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass} htmlFor="preferredLocations">
                Locations
              </label>
              <input
                id="preferredLocations"
                {...register('preferredLocations')}
                className={inputClass}
                placeholder="Maharashtra, India"
              />
            </div>

            <fieldset>
              <legend className={labelClass}>Preferred business stages</legend>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(stages, setStages, s)}
                    className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      stages.includes(s)
                        ? 'bg-accent-soft border-accent text-accent'
                        : 'bg-white border-line text-ink-soft hover:bg-canvas'
                    }`}
                    aria-pressed={stages.includes(s)}
                  >
                    {humanise(s)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>Funding types you offer</legend>
              <div className="flex flex-wrap gap-2">
                {FUNDING_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(fundingTypes, setFundingTypes, t)}
                    className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      fundingTypes.includes(t)
                        ? 'bg-accent-soft border-accent text-accent'
                        : 'bg-white border-line text-ink-soft hover:bg-canvas'
                    }`}
                    aria-pressed={fundingTypes.includes(t)}
                  >
                    {humanise(t)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label className={labelClass} htmlFor="investmentPreferences">
                Anything else
              </label>
              <textarea
                id="investmentPreferences"
                rows={3}
                {...register('investmentPreferences')}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Visibility" />
          <div className="flex items-start gap-3">
            <input id="active" type="checkbox" {...register('active')} className="mt-0.5 w-4 h-4 accent-accent" />
            <label htmlFor="active" className="text-[13px] text-ink leading-relaxed">
              Take part in matching
              <span className="block text-[12px] text-ink-soft mt-1">
                Turning this off removes you from business-side matching entirely.
              </span>
            </label>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Button type="submit" loading={formState.isSubmitting || update.isPending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}
