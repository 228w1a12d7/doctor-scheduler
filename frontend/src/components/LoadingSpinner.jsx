import PropTypes from 'prop-types'

function LoadingSpinner({ label = 'Loading...', className = '', compact = false }) {
  return (
    <output
      aria-live="polite"
      className={[
        'inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700',
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'inline-block animate-spin rounded-full border-2 border-slate-300 border-t-teal-700',
          compact ? 'h-3.5 w-3.5' : 'h-5 w-5',
        ].join(' ')}
      />
      <span className="font-medium">{label}</span>
    </output>
  )
}

LoadingSpinner.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
  compact: PropTypes.bool,
}

export default LoadingSpinner
