function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
      <p className="max-w-3xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
    </div>
  )
}

export default PageHeader
