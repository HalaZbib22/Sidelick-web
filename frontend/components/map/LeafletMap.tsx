"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: "you" | "walker";
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  /** Picker mode: current pin position (controlled by the parent). */
  value?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  markers?: MapMarker[];
  picker?: boolean;
  onPick?: (lat: number, lng: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pin(L: any, color: string, label?: string) {
  const html = label
    ? `<span style="background:${color};color:#fff;font-size:11px;font-weight:500;padding:3px 8px;border-radius:999px;white-space:nowrap;">${label}</span>`
    : `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color};"></span>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: label ? [44, 20] : [14, 14],
    iconAnchor: label ? [22, 10] : [7, 7],
  });
}

export function LeafletMap({
  center,
  value,
  zoom = 13,
  height = 200,
  markers = [],
  picker,
  onPick,
}: LeafletMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);

  // Init once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      const start = picker && value ? value : center;
      const map = L.map(elRef.current).setView([start.lat, start.lng], zoom);
      // Modern, clean basemap (CARTO Voyager) — free, no API key.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap, © CARTO",
        subdomains: "abcd",
        detectRetina: true,
        maxZoom: 20,
      }).addTo(map);
      mapRef.current = map;

      if (picker) {
        const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pin(L, "#C2461A") }).addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          onPick?.(p.lat, p.lng);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          onPick?.(e.latlng.lat, e.latlng.lng);
        });
        markerRef.current = marker;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picker: move pin + recenter when the controlled value changes (e.g. auto-locate)
  useEffect(() => {
    if (!picker || !value || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng]);
  }, [picker, value?.lat, value?.lng]);

  // Display: recenter when center changes
  useEffect(() => {
    if (picker || !mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng]);
  }, [picker, center.lat, center.lng]);

  // Display markers
  useEffect(() => {
    if (picker) return;
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (layerRef.current) mapRef.current.removeLayer(layerRef.current);
      const group = L.layerGroup();
      markers.forEach((m) =>
        L.marker([m.lat, m.lng], { icon: pin(L, m.kind === "you" ? "#2B1C14" : "#C2461A", m.label) }).addTo(group)
      );
      group.addTo(mapRef.current);
      layerRef.current = group;
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, picker]);

  // Teardown
  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    },
    []
  );

  return <div ref={elRef} style={{ height }} className="isolate w-full overflow-hidden rounded-2xl border border-border" />;
}
