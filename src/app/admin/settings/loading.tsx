/** Streaming boundary for the 1000-line settings form. */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-700 mb-8" />
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    </div>
  );
}
