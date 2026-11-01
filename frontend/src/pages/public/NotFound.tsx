import { Link } from 'react-router-dom';
import { PublicHeader, PublicFooter } from './Landing';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-[13px] font-semibold text-ink-faint uppercase tracking-wider">Error 404</p>
          <h1 className="text-2xl font-semibold text-ink tracking-tight mt-2">Page not found</h1>
          <p className="text-[14px] text-ink-soft mt-2">That page does not exist or has moved.</p>
          <Link
            to="/"
            className="inline-flex mt-6 text-sm font-medium bg-accent-deep text-white px-5 py-2.5 rounded-lg hover:bg-navy-light transition-colors"
          >
            Back to home
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
