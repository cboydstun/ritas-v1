/**
 * The delivery fee for an order comes from the ZIP, never from the request.
 *
 * `/api/save-booking` is public and unauthenticated by design, and it already
 * refuses to read a price out of the body. This is the same discipline applied
 * to the one money figure that used to come from a settings default rather than
 * from the order's own destination.
 *
 * A ZIP with no fee of its own is not in the service area, so it is **refused**
 * rather than priced through `getDeliveryFee`'s `?? 0`, which would hand out
 * free delivery to a ZIP nobody set a price for. The browser refuses it first;
 * this is the same rule on the side of the wire that is authoritative.
 *
 * Callers decide who is exempt. The admin order routes keep whatever the office
 * entered — it quotes by phone — which is the same reason they are exempt from
 * the order minimum. That exemption is the route's identity, never a body field.
 */

import { resolveZipFee, type DeliverySettings } from "./zones";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/site";

export const UNSERVICED_ZIP_CODE = "unserviced-zip";

export type DeliveryFeeResolution =
  | { ok: true; fee: number }
  | { ok: false; error: string; code: typeof UNSERVICED_ZIP_CODE };

export function resolveDeliveryFee(
  zipCode: string | undefined | null,
  settings: DeliverySettings | undefined,
): DeliveryFeeResolution {
  const resolved = resolveZipFee(zipCode ?? "", settings);

  if (resolved.source === "unserviced") {
    return {
      ok: false,
      code: UNSERVICED_ZIP_CODE,
      error: `We don't have a delivery price set for that ZIP code yet. Please call ${BUSINESS_PHONE_DISPLAY} to ask about your area.`,
    };
  }

  return { ok: true, fee: resolved.fee as number };
}
