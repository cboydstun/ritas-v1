/**
 * Streaming boundary for a 660-line page. Without one, navigation blocked on
 * the whole route segment with nothing on screen.
 */
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
      <div className="h-10 w-2/3 rounded-lg bg-charcoal/10 dark:bg-white/10 mb-6" />
      <div className="h-5 w-1/2 rounded-lg bg-charcoal/10 dark:bg-white/10 mb-12" />
      <div className="grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-72 rounded-2xl bg-charcoal/10 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}
