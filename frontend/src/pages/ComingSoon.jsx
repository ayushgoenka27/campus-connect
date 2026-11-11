import { Clock } from "lucide-react";

/**
 * Placeholder page shown for modules that are not yet implemented.
 * Replaced with the real page as each module is completed.
 */
export default function ComingSoon({ title = "Feature", description }) {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Clock size={28} strokeWidth={1.5} />
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>

      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
        {description ||
          `The ${title.toLowerCase()} module is being built. It will be available in an upcoming update.`}
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        In development
      </div>
    </div>
  );
}

