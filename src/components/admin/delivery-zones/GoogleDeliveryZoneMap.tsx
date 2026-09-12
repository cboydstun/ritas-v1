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
  const [boundaries, setBoundaries] = useState<Record<string, Boundary> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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

  // Load the Maps SDK once, by hand: the page has one map and adding a loader
  // dependency for it is not worth the bundle.
  useEffect(() => {
    if (!apiKey || mapRef.current || !containerRef.current || !boundaries)
      return;

    const start = () => {
      if (!containerRef.current || mapRef.current) return;
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: CENTER,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
      });
    };

    if (window.google?.maps) {
      start();
      return;
    }

    const existing = document.getElementById(
      "gmaps-sdk",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", start);
      return () => existing.removeEventListener("load", start);
    }

    const script = document.createElement("script");
    script.id = "gmaps-sdk";
    // `loading=async` is what the SDK asks for; without it it warns on every
    // load that the import pattern is suboptimal.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async`;
    script.async = true;
    script.onload = start;
    script.onerror = () => setError("Could not load Google Maps.");
    document.head.appendChild(script);
  }, [apiKey, boundaries]);

  // Repaint polygons whenever the fees change. Keyed on `rows`, which the page
  // memoises on the settings object alone, so a keystroke in a fee input cannot
  // tear down every polygon.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundaries) return;

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

      const polygon = new google.maps.Polygon({
        paths: boundary.coordinates.map(([lng, lat]) => ({ lat, lng })),
        ...style,
        map,
      });
      polygon.addListener("click", () => onZipClick(zipCode));
      drawn.set(zipCode, polygon);
    }
  }, [rows, boundaries, selectedZip, onZipClick]);

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
