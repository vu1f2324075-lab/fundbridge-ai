/**
 * Funding requirement form.
 *
 * Required for the matching engine's funding-compatibility factor. Without it
 * that factor reports UNKNOWN and every match becomes provisional, which the
 * copy here says explicitly rather than leaving the user to discover it.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Card, CardHeader, ErrorPanel, FieldError, LoadingPanel, PageHeader } from '../../components/ui';
import { useMeta, useProfile, useSaveRequirement } from '../../hooks/queries';
import { ApiError } from '../../lib/api';
import { formatCurrency, humanise } from '../../utils/format';

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';
const labelClass = 'block text-[13px] font-medium text-ink mb-1.5';

interface FormValues {
  amountRequired: string;
  currency: string;
  purpose: string;
  fundingType: string;
  preferredTimeline: string;
  preferredLocation: string;
  additionalRequirements: string;
}

export default function FundingRequirementPage() {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const { data: meta } = useMeta();
  const save = useSaveRequirement();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState } = useForm<FormValues>({
    defaultValues: { currency: 'INR', fundingType: 'ANY_SUITABLE' },
  });

  const requirement = data?.business.fundingRequirement ?? null;

  useEffect(() => {
    if (!requirement) return;
    reset({
      amountRequired: String(requirement.amountRequired),
      currency: requirement.currency,
      purpose: requirement.purpose,
      fundingType: requirement.fundingType,
      preferredTimeline: requirement.preferredTimeline ?? '',
      preferredLocation: requirement.preferredLocation ?? '',
      additionalRequirements: requirement.additionalRequirements ?? '',
    });
  }, [requirement, reset]);

  const amountPreview = Number(watch('amountRequired'));

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSaved(false);
    try {
      await save.mutateAsync({
        amountRequired: Number(values.amountRequired),
        currency: values.currency || 'INR',
        purpose: values.purpose.trim(),
        fundingType: values.fundingType,
        preferredTimeline: values.preferredTimeline.trim() || null,
        preferredLocation: values.preferredLocation.trim() || null,
        additionalRequirements: values.additionalRequirements.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save your requirement.');
    }
  };

  if (isLoading) return <LoadingPanel label="Loading…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your requirement.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title="Funding requirement"
        description="How much you need and what for. Matching cannot assess funding compatibility without this."
      />

      {saved && (
        <div className="mb-5 bg-success-bg border border-success/25 rounded-lg px-4 py-2.5" role="status">
          <p className="text-[13px] text-ink">
            Saved. Recalculate your readiness and matches to see results based on the new figures.
          </p>
        </div>
      )}

      {formError && (
        <div className="mb-5">
          <ErrorPanel message={formError} />
        </div>
      )}

      <div className="max-w-2xl">
        <Card>
          <CardHeader title="What you need" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="amountRequired">
                Amount required <span className="text-danger">*</span>
              </label>
              <input
                id="amountRequired"
                type="number"
                step="any"
                {...register('amountRequired', {
                  required: 'Enter the amount you need',
                  validate: (v) => Number(v) > 0 || 'Enter an amount greater than zero',
                })}
                className={inputClass}
              />
              <FieldError message={formState.errors.amountRequired?.message} />
              {Number.isFinite(amountPreview) && amountPreview > 0 && (
                <p className="text-[12px] text-ink-soft mt-1">{formatCurrency(amountPreview)}</p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="fundingType">
                Funding type <span className="text-danger">*</span>
              </label>
              <select id="fundingType" {...register('fundingType')} className={inputClass}>
                {meta?.vocabularies.fundingTypes.map((t) => (
                  <option key={t} value={t}>
                    {humanise(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="purpose">
                Purpose <span className="text-danger">*</span>
              </label>
              <input
                id="purpose"
                list="purposes"
                {...register('purpose', { required: 'Describe what the funding is for' })}
                className={inputClass}
              />
              {/* Datalist, not select: guides toward the controlled vocabulary
                  without rejecting a purpose it does not list. */}
              <datalist id="purposes">
                {meta?.vocabularies.fundingPurposes.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <FieldError message={formState.errors.purpose?.message} />
              <p className="text-[12px] text-ink-soft mt-1">
                Matching compares this against the purposes each scheme supports, so a listed value matches more
                reliably than free text.
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="preferredTimeline">
                Preferred timeline
              </label>
              <input id="preferredTimeline" {...register('preferredTimeline')} className={inputClass} />
            </div>

            <div>
              <label className={labelClass} htmlFor="preferredLocation">
                Preferred location
              </label>
              <input id="preferredLocation" {...register('preferredLocation')} className={inputClass} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="additionalRequirements">
                Anything else
              </label>
              <textarea
                id="additionalRequirements"
                rows={3}
                {...register('additionalRequirements')}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>

          <div className="mt-5">
            <Button type="submit" loading={formState.isSubmitting || save.isPending}>
              {requirement ? 'Update requirement' : 'Save requirement'}
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
