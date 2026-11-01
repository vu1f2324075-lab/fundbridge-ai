/**
 * Settings.
 *
 * Also the place where privacy and security are explained in plain language.
 * The brief asks for security to operate invisibly rather than making the UI
 * frightening, with the detail available where a user would look for it — which
 * is here.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Card, CardHeader, ErrorPanel, FieldError, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useMeta, useProfile, useUpdateProfile } from '../../hooks/queries';
import { ApiError, api } from '../../lib/api';
import { humanise } from '../../utils/format';

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';
const labelClass = 'block text-[13px] font-medium text-ink mb-1.5';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ChangePassword() {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<PasswordForm>();

  const onSubmit = async (values: PasswordForm) => {
    setFormError(null);
    setDone(false);
    try {
      await api.post('/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setDone(true);
      // Cleared immediately so the plaintext does not sit in form state.
      reset();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not change your password.');
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" description="At least 10 characters." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm" noValidate>
        <div>
          <label className={labelClass} htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword', { required: 'Enter your current password' })}
            className={inputClass}
          />
          <FieldError message={formState.errors.currentPassword?.message} />
        </div>

        <div>
          <label className={labelClass} htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register('newPassword', {
              required: 'Enter a new password',
              minLength: { value: 10, message: 'Use at least 10 characters' },
            })}
            className={inputClass}
          />
          <FieldError message={formState.errors.newPassword?.message} />
        </div>

        <div>
          <label className={labelClass} htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword', {
              required: 'Confirm your new password',
              // Checked here rather than server-side: the server has no need to
              // receive the value twice.
              validate: (v, values) => v === values.newPassword || 'The passwords do not match',
            })}
            className={inputClass}
          />
          <FieldError message={formState.errors.confirmPassword?.message} />
        </div>

        {done && (
          <div className="bg-success-bg border border-success/25 rounded-lg px-3 py-2" role="status">
            <p className="text-[13px] text-ink">Password changed.</p>
          </div>
        )}
        {formError && <ErrorPanel message={formError} />}

        <Button type="submit" loading={formState.isSubmitting}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

function Discoverability() {
  const { data } = useProfile();
  const update = useUpdateProfile();
  const discoverable = data?.business.discoverable ?? true;

  return (
    <Card>
      <CardHeader
        title="Investor discoverability"
        description="Whether registered investors may discover your business."
      />
      <div className="flex items-start gap-3">
        <input
          id="discoverable"
          type="checkbox"
          checked={discoverable}
          onChange={(e) => update.mutate({ discoverable: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-accent"
        />
        <label htmlFor="discoverable" className="text-[13px] text-ink leading-relaxed">
          Allow investors to discover my business
          <span className="block text-[12px] text-ink-soft mt-1">
            Turning this off keeps your profile out of investor-side matching entirely. Your proposals and financial
            details are never exposed by this setting — investor features are not implemented yet in any case.
          </span>
        </label>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();

  return (
    <div>
      <PageHeader title="Settings" description="Your account, privacy and security." />

      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader title="Account" />
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Name</dt>
              <dd className="text-ink">{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Email</dt>
              <dd className="text-ink">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Account type</dt>
              <dd className="text-ink">{humanise(user?.role)}</dd>
            </div>
          </dl>
        </Card>

        <Discoverability />
        <ChangePassword />

        <Card>
          <CardHeader title="Your data and privacy" />
          <ul className="space-y-2.5 text-[13px] text-ink-soft leading-relaxed">
            {[
              'Your business information is private to your account. No other user can read it.',
              'Your password is stored only as a one-way bcrypt hash and is never logged or returned by the API.',
              'Your session is held in a server-only cookie that page scripts cannot read, which prevents it being stolen by a cross-site scripting bug.',
              'Government scheme records are reference data shared across the platform. Your profile is never sent to a scheme provider.',
              'Analysis results are derived from the information you enter and are stored against your account only.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                  —
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>

        {meta?.features && (
          <Card>
            <CardHeader
              title="Feature availability"
              description="What is implemented in this build. Nothing is shown elsewhere in the interface that is not available here."
            />
            <ul className="grid gap-2 sm:grid-cols-2">
              {Object.entries(meta.features).map(([key, available]) => (
                <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                  </span>
                  <span className={available ? 'text-success text-[12px]' : 'text-ink-faint text-[12px]'}>
                    {available ? 'Available' : 'Not implemented'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
