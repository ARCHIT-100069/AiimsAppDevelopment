import { IconCross } from "@aiims/ui-web";

/** Next.js route-level Suspense fallback — shown while a server component's
 *  data fetch is in flight (initial load or a navigation), instead of a
 *  blank white screen. Deliberately quick and calm, not the one-time
 *  animated welcome splash (that only plays once per session). */
export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-teal-700">
        <IconCross width={28} height={28} />
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />
      </div>
    </div>
  );
}
