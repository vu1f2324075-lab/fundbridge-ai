/**
 * Create account.
 *
 * The role choice is STARTUP or INVESTOR only. ADMIN is absent here because it
 * is absent from the backend's registration enum entirely — administrators are
 * provisioned by the seed or promoted by an existing admin, never self-assigned.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { Button, FieldError } from '../../components/ui';
import { PublicHeader, PublicFooter } from './Landing';

/** Mirrors the backend's registerSchema so the user sees errors before a round trip. */
const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(200)
      .refine((p) => p.trim().length > 0, 'Password cannot be only whitespace'),
    role: z.enum(['STARTUP', 'INVESTOR']),
    organisationName: z.string().trim().min(2, 'Enter a name').max(200),
  })
  .strict();

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const roleFromQuery: 'STARTUP' | 'INVESTOR' = requestedRole === 'INVESTOR' ? 'INVESTOR' : 'STARTUP';

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Preselected from ?role= so arriving from a role's sign-in portal keeps
    // that choice. Anything unrecognised falls back to STARTUP, and ADMIN is
    // not accepted here at all - administrators are provisioned, not
    // self-registered, and the backend rejects the role regardless.
    defaultValues: { role: roleFromQuery },
  });

  const role = watch('role');

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await createAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        // The backend expects a different key per role, and requires exactly
        // the one matching the chosen role.
        ...(values.role === 'STARTUP'
          ? { businessName: values.organisationName }
          : { investorName: values.organisationName }),
      });
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        // Map server field errors onto the form so they appear next to the
        // input rather than as a detached banner.
        const mapped: Record<string, keyof FormValues> = {
          name: 'name',
          email: 'email',
          password: 'password',
          role: 'role',
          businessName: 'organisationName',
          investorName: 'organisationName',
        };
        let handled = false;
        for (const [serverField, message] of Object.entries(err.fields)) {
          const field = mapped[serverField];
          if (field) {
            setError(field, { message });
            handled = true;
          }
        }
        if (!handled) setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm bg-white border border-line rounded-lg outline-none focus:border-accent transition-colors';

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white border border-line rounded-[10px] p-6 shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
            <h1 className="text-lg font-semibold text-ink tracking-tight">Create your account</h1>
            <p className="text-[13px] text-ink-soft mt-1">
              You can start with just a name — the rest can be filled in later.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <fieldset>
                <legend className="block text-[13px] font-medium text-ink mb-1.5">I am a</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['STARTUP', 'Business owner'],
                      ['INVESTOR', 'Investor'],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-center justify-center px-3 py-2 text-[13px] font-medium border rounded-lg cursor-pointer transition-colors ${
                        role === value
                          ? 'bg-accent-soft border-accent text-accent'
                          : 'bg-white border-line text-ink-soft hover:bg-canvas'
                      }`}
                    >
                      <input type="radio" value={value} {...register('role')} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
                <FieldError message={errors.role?.message} />
              </fieldset>

              <div>
                <label htmlFor="name" className="block text-[13px] font-medium text-ink mb-1.5">
                  Your name
                </label>
                <input id="name" autoComplete="name" {...register('name')} className={inputClass} />
                <FieldError message={errors.name?.message} />
              </div>

              <div>
                <label htmlFor="organisationName" className="block text-[13px] font-medium text-ink mb-1.5">
                  {role === 'INVESTOR' ? 'Investor or firm name' : 'Business name'}
                </label>
                <input
                  id="organisationName"
                  autoComplete="organization"
                  {...register('organisationName')}
                  className={inputClass}
                />
                <FieldError message={errors.organisationName?.message} />
              </div>

              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                  Email
                </label>
                <input id="email" type="email" autoComplete="email" {...register('email')} className={inputClass} />
                <FieldError message={errors.email?.message} />
              </div>

              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  className={inputClass}
                />
                <FieldError message={errors.password?.message} />
                <p className="text-[12px] text-ink-soft mt-1">
                  At least 10 characters. A memorable phrase is stronger than a short complex password.
                </p>
              </div>

              {formError && (
                <div className="bg-danger-bg border border-danger/30 rounded-lg px-3 py-2" role="alert">
                  <p className="text-[13px] text-ink">{formError}</p>
                </div>
              )}

              <Button type="submit" loading={isSubmitting} className="w-full">
                Create account
              </Button>
            </form>
          </div>

          <p className="text-[13px] text-ink-soft text-center mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-ink-faint text-center mt-6 leading-relaxed">
            Your business information is private to your account and is not shared with other users. Passwords are
            stored only as a one-way hash.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
