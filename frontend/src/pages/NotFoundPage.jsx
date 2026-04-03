import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/85 p-10 text-center shadow-lg shadow-slate-200/60">
        <h1 className="text-4xl font-semibold">Page not found</h1>
        <p className="mt-3 text-slate-600">
          The route you requested does not exist in the scheduler frontend.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Back to login
        </Link>
      </section>
    </main>
  )
}

export default NotFoundPage
