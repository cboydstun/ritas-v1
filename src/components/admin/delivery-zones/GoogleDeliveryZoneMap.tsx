"use client";

import { useEffect, useRef, useState } from "react";
import type { ZipFeeRow } from "@/lib/delivery/zipFeeRows";
import { bucketForFee } from "@/lib/delivery/feeBuckets";

interface Boundary {
  name: string;
  centroid: [number, number];
  coordinates: [number, number][];
}

interface Props {
  rows: ZipFeeRow[];
  selectedZip: string | null;
  onZipClick: (zipCode: string) => void;
}

/**
 * Load the Maps SDK, resolving only once its constructors actually exist.
 *
 * **The script's `load` event is too early.** Measured against the live SDK:
 * at `onload`, both `google.maps.Map` and `google.maps.importLibrary` are
 * `undefined`; only after the `callback` parameter fires are they functions.
 * Two attempts at this shipped blank maps — one calling `new google.maps.Map`
 * on load ("Map is not a constructor"), one calling `importLibrary` on load
 * ("importLibrary is not a function"). The callback is the documented signal
 * and the only one that holds.
 *
 * Module-level, so a remount reuses the in-flight load instead of appending a
 * second copy of the script.
 */
let sdkPromise: Promise<void> | null = null;

function loadMapsSdk(apiKey: string): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === "function") {
    return Promise.resolve();
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const callbackName = "__ritasMapsReady";
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.id = "gmaps-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      // Cleared so a later mount can retry rather than awaiting a dead promise.
      sdkPromise = null;
      reject(new Error("Google Maps SDK failed to load"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

/** Downtown San Antonio, near enough for an initial fit. */
const CENTER = { lat: 29.4241, lng: -98.4936 };

/**
 * The delivery-zone map.
 *
 * The 129KB of ZCTA boundary geometry is **fetched from `/data/`, never
 * imported** — an import would put it in a JS bundle and in the CI build's
 * module graph for the sake of one admin page.
 *
 * Without `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` this renders a notice rather than a
 * blank panel. The ZIP table beside it is the page's real control surface; the
 * map is how you see coverage, not how you edit it.
 */
export function GoogleDeliveryZoneMap({
  rows,
  selectedZip,
  onZipClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());
  // The constructors come from the imported library rather than from the
  // `google.maps` namespace, so nothing here depends on the SDK back-filling
  // that namespace for compatibility.
  const libRef = useRef<google.maps.MapsLibrary | null>(null);
  const [boundaries, setBoundaries] = useState<Record<string, Boundary> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let cancelled = false;
    fetch("/data/zip-boundaries.json")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)),
      )
      .then((data: Record<string, Boundary>) => {
        if (!cancelled) setBoundaries(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load ZIP boundaries.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the Maps SDK once, by hand: the page has one map and a loader
  // dependency is not worth the bundle for it.
  useEffect(() => {
    if (!apiKey || mapRef.current || !containerRef.current || !boundaries)
      return;

    let cancelled = false;

    loadMapsSdk(apiKey)
      .then(async () => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const lib = (await google.maps.importLibrary(
          "maps",
        )) as google.maps.MapsLibrary;
        // The import is a suspension point: the component may have unmounted,
        // or another pass may have built the map, while it was pending.
        if (cancelled || !containerRef.current || mapRef.current) return;

        libRef.current = lib;
        mapRef.current = new lib.Map(containerRef.current, {
          center: CENTER,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
        });
        // State, not just the ref: the polygon effect draws onto a map held in
        // a ref, and a ref assignment does not re-render, so without this the
        // polygons are skipped depending on which effect wins the race.
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Google Maps.");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, boundaries]);

  // Repaint polygons whenever the fees change. Keyed on `rows`, which the page
  // memoises on the settings object alone, so a keystroke in a fee input cannot
  // tear down every polygon.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !boundaries) return;
    // `mapReady` is read only to make the dependency real: the map lives in a
    // ref, so this effect needs a rendered value to re-run on once it exists.
    void mapReady;

    const feeByZip = new Map(rows.map((r) => [r.zipCode, r.fee]));
    const drawn = polygonsRef.current;

    for (const [zipCode, boundary] of Object.entries(boundaries)) {
      const fee = feeByZip.has(zipCode) ? feeByZip.get(zipCode)! : null;
      const bucket = bucketForFee(fee);
      const selected = zipCode === selectedZip;

      const style = {
        fillColor: bucket.fill,
        fillOpacity: selected ? 0.75 : 0.45,
        strokeColor: selected ? "#111827" : bucket.stroke,
        strokeWeight: selected ? 3 : 1,
      };

      const existing = drawn.get(zipCode);
      if (existing) {
        existing.setOptions(style);
        continue;
      }

      const polygon = new lib.Polygon({
        paths: boundary.coordinates.map(([lng, lat]) => ({ lat, lng })),
        ...style,
        map,
      });
      polygon.addListener("click", () => onZipClick(zipCode));
      drawn.set(zipCode, polygon);
    }
  }, [rows, boundaries, selectedZip, onZipClick, mapReady]);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
        Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to see the coverage
        map. Every ZIP is still editable from the table.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-96 overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full min-h-96 w-full" />
      {error && (
        <p className="absolute inset-x-0 bottom-0 bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
