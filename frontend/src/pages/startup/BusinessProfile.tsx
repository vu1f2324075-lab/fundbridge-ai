/**
 * Business profile form.
 *
 * Partial saving is the whole point: a user can fill one section and come back
 * later, and the system tells them what is missing instead of refusing to save.
 * Only the business name is required.
 *
 * Registration questions are three-state — yes / no / not answered — because
 * the matching engine treats them differently. Knowing a business is *not*
 * Udyam-registered is information that can block a scheme; not knowing is a gap
 * that makes the match provisional. A checkbox would collapse those.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  FieldError,
  LoadingPanel,
  PageHeader,
} from '../../components/ui';
import { useMeta, useProfile, useUpdateProfile } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { humanise } from '../../utils/format';
import type { BusinessProfile } from '../../types/api';

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';
const labelClass = 'block text-[13px] font-medium text-ink mb-1.5';

/** Empty string from an untouched input means "no value", not zero. */
function toNumberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toTextOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** Three-state select: '' (unanswered), 'true', 'false'. */
function toTristate(value: unknown): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function fromTristate(value: boolean | null | undefined): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}

/** Comma-separated input to a trimmed list. */
function toList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type FormValues = Record<string, string>;

export default function BusinessProfilePage() {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const { data: meta } = useMeta();
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>();

  const business = data?.business;

  // Populate once the profile arrives. `reset` rather than defaultValues,
  // because the data is not available on first render.
  useEffect(() => {
    if (!business) return;
    reset({
      businessName: business.businessName ?? '',
      businessType: business.businessType ?? '',
      industry: business.industry ?? '',
      subIndustry: business.subIndustry ?? '',
      location: business.location ?? '',
      state: business.state ?? '',
      country: business.country ?? 'India',
      foundedYear: business.foundedYear?.toString() ?? '',
      businessStage: business.businessStage ?? '',
      teamSize: business.teamSize?.toString() ?? '',
      description: business.description ?? '',
      problem: business.problem ?? '',
      solution: business.solution ?? '',
      targetCustomer: business.targetCustomer ?? '',
      productStatus: business.productStatus ?? '',
      customerCount: business.customerCount?.toString() ?? '',
      annualRevenue: business.annualRevenue?.toString() ?? '',
      annualExpenses: business.annualExpenses?.toString() ?? '',
      profitLoss: business.profitLoss?.toString() ?? '',
      existingFunding: business.existingFunding?.toString() ?? '',
      existingDebt: business.existingDebt?.toString() ?? '',
      growthRate: business.growthRate !== null && business.growthRate !== undefined ? String(business.growthRate * 100) : '',
      marketSize: business.marketSize?.toString() ?? '',
      founderExperience: business.founderExperience?.toString() ?? '',
      teamStrength: business.teamStrength ?? '',
      customers: business.customers.join(', '),
      partnerships: business.partnerships.join(', '),
      certifications: business.certifications.join(', '),
      intellectualProperty: business.intellectualProperty.join(', '),
      udyamRegistered: fromTristate(business.udyamRegistered),
      dpiitRecognised: fromTristate(business.dpiitRecognised),
      gstRegistered: fromTristate(business.gstRegistered),
      registrationNumber: business.registrationNumber ?? '',
    });
  }, [business, reset]);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSaved(false);

    const payload: Partial<BusinessProfile> = {
      businessName: values['businessName']?.trim() || undefined,
      businessType: (toTextOrNull(values['businessType']) as BusinessProfile['businessType']),
      industry: toTextOrNull(values['industry']),
      subIndustry: toTextOrNull(values['subIndustry']),
      location: toTextOrNull(values['location']),
      state: toTextOrNull(values['state']),
      country: toTextOrNull(values['country']),
      foundedYear: toNumberOrNull(values['foundedYear']),
      businessStage: (toTextOrNull(values['businessStage']) as BusinessProfile['businessStage']),
      teamSize: toNumberOrNull(values['teamSize']),
      description: toTextOrNull(values['description']),
      problem: toTextOrNull(values['problem']),
      solution: toTextOrNull(values['solution']),
      targetCustomer: toTextOrNull(values['targetCustomer']),
      productStatus: (toTextOrNull(values['productStatus']) as BusinessProfile['productStatus']),
      customerCount: toNumberOrNull(values['customerCount']),
      annualRevenue: toNumberOrNull(values['annualRevenue']),
      annualExpenses: toNumberOrNull(values['annualExpenses']),
      profitLoss: toNumberOrNull(values['profitLoss']),
      existingFunding: toNumberOrNull(values['existingFunding']),
      existingDebt: toNumberOrNull(values['existingDebt']),
      // Entered as a percentage for readability, stored as a fraction.
      growthRate: (() => {
        const pct = toNumberOrNull(values['growthRate']);
        return pct === null ? null : pct / 100;
      })(),
      marketSize: toNumberOrNull(values['marketSize']),
      founderExperience: toNumberOrNull(values['founderExperience']),
      teamStrength: toTextOrNull(values['teamStrength']),
      customers: toList(values['customers']),
      partnerships: toList(values['partnerships']),
      certifications: toList(values['certifications']),
      intellectualProperty: toList(values['intellectualProperty']),
      udyamRegistered: toTristate(values['udyamRegistered']),
      dpiitRecognised: toTristate(values['dpiitRecognised']),
      gstRegistered: toTristate(values['gstRegistered']),
      registrationNumber: toTextOrNull(values['registrationNumber']),
    };

    try {
      await update.mutateAsync(payload);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save your changes.');
    }
  };

  if (isLoading) return <LoadingPanel label="Loading your profile…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your profile.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const v = meta?.vocabularies;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title="Business profile"
        description="Fill in what you know. Nothing except your business name is required — the readiness analysis reports what is still missing."
        action={
          <Button type="submit" loading={formState.isSubmitting || update.isPending}>
            Save changes
          </Button>
        }
      />

      {saved && (
        <div className="mb-5 bg-success-bg border border-success/25 rounded-lg px-4 py-2.5" role="status">
          <p className="text-[13px] text-ink">
            Saved. Your readiness score and scheme matches were cleared because the inputs changed — recalculate them to
            see updated results.
          </p>
        </div>
      )}

      {formError && (
        <div className="mb-5">
          <ErrorPanel message={formError} />
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Business basics" description="Used for industry, stage and location matching." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="businessName">
                Business name <span className="text-danger">*</span>
              </label>
              <input id="businessName" {...register('businessName')} className={inputClass} />
              <FieldError message={formState.errors['businessName']?.message} />
            </div>

            <div>
              <label className={labelClass} htmlFor="businessType">
                Legal business type
              </label>
              <select id="businessType" {...register('businessType')} className={inputClass}>
                <option value="">Not specified</option>
                {v?.businessTypes.map((t) => (
                  <option key={t} value={t}>
                    {humanise(t)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="businessStage">
                Business stage
              </label>
              <select id="businessStage" {...register('businessStage')} className={inputClass}>
                <option value="">Not specified</option>
                {v?.businessStages.map((s) => (
                  <option key={s} value={s}>
                    {humanise(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="industry">
                Industry
              </label>
              <input id="industry" list="industries" {...register('industry')} className={inputClass} />
              {/* A datalist rather than a select: the controlled vocabulary
                  guides input without rejecting a sector it does not list. */}
              <datalist id="industries">
                {v?.industries.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass} htmlFor="subIndustry">
                Sub-industry
              </label>
              <input id="subIndustry" {...register('subIndustry')} className={inputClass} />
            </div>

            <div>
              <label className={labelClass} htmlFor="location">
                City
              </label>
              <input id="location" {...register('location')} className={inputClass} />
            </div>

            <div>
              <label className={labelClass} htmlFor="state">
                State
              </label>
              <input id="state" {...register('state')} className={inputClass} />
            </div>

            <div>
              <label className={labelClass} htmlFor="foundedYear">
                Year founded
              </label>
              <input id="foundedYear" type="number" {...register('foundedYear')} className={inputClass} />
            </div>

            <div>
              <label className={labelClass} htmlFor="teamSize">
                Team size
              </label>
              <input id="teamSize" type="number" {...register('teamSize')} className={inputClass} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your business story"
            description="Used for semantic relevance and proposal assistance. Substantive answers score better than placeholders."
          />
          <div className="space-y-4">
            {(
              [
                ['description', 'What your business does'],
                ['problem', 'The problem you solve'],
                ['solution', 'Your solution'],
                ['targetCustomer', 'Your target customer'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass} htmlFor={field}>
                  {label}
                </label>
                <textarea id={field} rows={3} {...register(field)} className={`${inputClass} resize-y`} />
              </div>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="productStatus">
                  Product or service status
                </label>
                <select id="productStatus" {...register('productStatus')} className={inputClass}>
                  <option value="">Not specified</option>
                  {v?.productStatuses.map((s) => (
                    <option key={s} value={s}>
                      {humanise(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="customerCount">
                  Number of customers
                </label>
                <input id="customerCount" type="number" {...register('customerCount')} className={inputClass} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Financial information"
            description="The most heavily weighted readiness component (25%). Amounts in rupees."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['annualRevenue', 'Annual revenue'],
                ['annualExpenses', 'Annual expenses'],
                ['profitLoss', 'Profit or loss (may be negative)'],
                ['existingFunding', 'Funding raised to date'],
                ['existingDebt', 'Existing debt'],
                ['marketSize', 'Estimated market size'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass} htmlFor={field}>
                  {label}
                </label>
                <input id={field} type="number" step="any" {...register(field)} className={inputClass} />
              </div>
            ))}
            <div>
              <label className={labelClass} htmlFor="growthRate">
                Annual growth rate (%)
              </label>
              <input id="growthRate" type="number" step="any" {...register('growthRate')} className={inputClass} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Team and traction" description="Comma-separate multiple entries." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="founderExperience">
                Founder experience (years)
              </label>
              <input id="founderExperience" type="number" {...register('founderExperience')} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="teamStrength">
                Team strengths
              </label>
              <textarea id="teamStrength" rows={2} {...register('teamStrength')} className={`${inputClass} resize-y`} />
            </div>
            {(
              [
                ['customers', 'Named customers or pilots'],
                ['partnerships', 'Partnerships'],
                ['certifications', 'Certifications'],
                ['intellectualProperty', 'Intellectual property'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass} htmlFor={field}>
                  {label}
                </label>
                <input id={field} {...register(field)} className={inputClass} placeholder="Comma separated" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Registrations"
            description="Many government schemes gate eligibility on these. Answering 'No' is useful — leaving it unanswered makes a match provisional."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['udyamRegistered', 'Udyam registered'],
                ['dpiitRecognised', 'DPIIT recognised'],
                ['gstRegistered', 'GST registered'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className={labelClass} htmlFor={field}>
                  {label}
                </label>
                <select id={field} {...register(field)} className={inputClass}>
                  <option value="">Not answered</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            ))}
            <div className="sm:col-span-3">
              <label className={labelClass} htmlFor="registrationNumber">
                Registration number
              </label>
              <input id="registrationNumber" {...register('registrationNumber')} className={inputClass} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" loading={formState.isSubmitting || update.isPending}>
          Save changes
        </Button>
        <p className="text-[12px] text-ink-soft">
          Saving clears your readiness score and scheme matches, because they were computed from the previous values.
        </p>
      </div>
    </form>
  );
}
