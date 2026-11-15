/**
 * Accessible Route Loading Fallback (P7-09)
 * Rendered by React.Suspense while on-demand route chunks are dynamically loaded.
 * Uses semantic ARIA attributes to announce loading state to screen readers.
 */
export default function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      className="space-y-6 animate-pulse p-4 sm:p-6"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-xl" />
          <div className="h-4 w-72 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-28 bg-slate-200 rounded-xl hidden sm:block" />
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="h-44 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 bg-slate-100 rounded-lg" />
              <div className="h-4 w-12 bg-slate-100 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-4/5 bg-slate-200 rounded-lg" />
              <div className="h-3.5 w-full bg-slate-100 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Loading page content, please wait...</span>
    </div>
  );
}

