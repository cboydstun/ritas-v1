import { revalidatePath } from "next/cache";
import { safeErrorSummary } from "@/lib/safe-error";

/**
 * Drop the ISR entry for a landing path after an admin write.
 *
 * The public catch-all is `revalidate = 60`, so without this an admin
 * publishes and then stares at the old version for up to a minute wondering
 * whether the save worked.
 *
 * **Always caught.** This runs after the write has already committed, so a
 * throw out of the cache API would turn a successful save into a 500 and
 * invite the admin to submit it again.
 */
export async function revalidateLandingPath(...paths: string[]) {
  for (const path of paths) {
    if (!path) continue;
    try {
      revalidatePath(path);
    } catch (error) {
      console.error(
        "Could not revalidate landing path:",
        safeErrorSummary(error),
      );
    }
  }
}
