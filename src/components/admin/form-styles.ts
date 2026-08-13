/**
 * The two class strings every hand-rolled admin form field uses.
 *
 * `BlogPostForm` and `BlackoutDateForm` each carry their own copy. The
 * landing-page editor would have made a third and a fourth, which is the point
 * at which a drifting focus ring or border colour becomes a real problem
 * rather than a curiosity.
 */
export const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal";

export const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

/** The small ▲ / ▼ / × control on a reorderable row. */
export const rowButtonClass =
  "px-2 py-1 text-sm rounded-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed";
