import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="card space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome</h2>
      <p className="text-slate-600">
        Choose a route to start building the quiz experience.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Go to Admin
        </Link>
        <Link href="/display" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
          Go to Display
        </Link>
        <Link href="/team" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
          Go to Team
        </Link>
      </div>
    </section>
  );
}
