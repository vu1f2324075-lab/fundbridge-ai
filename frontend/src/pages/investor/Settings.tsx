/**
 * Investor settings.
 *
 * Account facts plus the privacy explanation. Preference editing lives on its own
 * page because it is substantial and drives matching.
 */
import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { humanise } from '../../utils/format';

const PRIVACY_POINTS = [
  'You see only businesses whose owners have opted into discovery.',
  'Exact financial figures are never shared with you. Revenue appears as a band.',
  'Uploaded proposals are private to the business and are not exposed through discovery.',
  'Your shortlist status and notes are private to you and are never shown to the business.',
  'Your preferences are visible to matched businesses as stated criteria, not as contact details.',
];

export default function InvestorSettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Settings" description="Your account and privacy." />

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

        <Card>
          <CardHeader title="Matching preferences" />
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Your industries, stages, locations, funding types and investment range determine your matches. A preference
            you leave unstated is scored neutrally rather than as a match.
          </p>
          <Link
            to="/investor/preferences"
            className="inline-flex mt-3 text-[13px] font-medium text-accent hover:underline"
          >
            Edit preferences
          </Link>
        </Card>

        <Card>
          <CardHeader title="Privacy" />
          <ul className="space-y-2.5 text-[13px] text-ink-soft leading-relaxed">
            {PRIVACY_POINTS.map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="text-ink-faint flex-shrink-0" aria-hidden="true">
                  —
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
