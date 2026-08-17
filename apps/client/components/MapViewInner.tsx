'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapViewProps {
  mode: 'pin' | 'pulse' | 'tracking';
  center: LatLng;
  onCenterChange?: (coords: LatLng) => void;
  masterPosition?: LatLng | null;
  height?: number;
  className?: string;
}

/*
 * Маркер Leaflet — это строка HTML, а не React-дерево: классы Tailwind сюда не
 * доедут. Поэтому цвета берутся из тех же CSS-переменных через var(), а не
 * зашиваются шестнадцатеричными литералами: смена токена меняет и карту.
 * Значение после запятой — запасное, если переменная не объявлена.
 */
const PRIMARY = 'var(--color-primary, #1E40AF)';
const SURFACE = 'var(--color-surface, #FFFFFF)';
const SHADOW = 'var(--shadow-raised, 0 4px 12px rgba(15, 23, 42, 0.08))';

/* Тот же контур, что у CarIcon из @masterqala/ui — вместо эмодзи-машинки. */
const CAR_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="M4 16.5v-3l1.8-4.4A2 2 0 0 1 7.6 8h8.8a2 2 0 0 1 1.8 1.1L20 13.5v3" />' +
  '<path d="M3 16.5h18M7 19.5v-3M17 19.5v-3" /></svg>';

const pinIcon = L.divIcon({
  className: '',
  html:
    `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${PRIMARY};` +
    `transform:rotate(-45deg);box-shadow:${SHADOW}"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const masterIcon = L.divIcon({
  className: '',
  html:
    `<div style="width:30px;height:30px;border-radius:50%;background:${SURFACE};` +
    `border:3px solid ${PRIMARY};color:${PRIMARY};display:flex;align-items:center;` +
    `justify-content:center;box-shadow:${SHADOW}">${CAR_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapViewInner({ mode, center, onCenterChange, masterPosition, height = 220, className = '' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const masterMarkerRef = useRef<L.Marker | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!containerRef.current || mode === 'pulse') return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(
      [center.lat, center.lng],
      15,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    if (mode === 'pin') {
      const marker = L.marker([center.lat, center.lng], { icon: pinIcon }).addTo(map);
      map.on('move', () => {
        const c = map.getCenter();
        marker.setLatLng(c);
      });
      map.on('moveend', () => {
        const c = map.getCenter();
        onCenterChangeRef.current?.({ lat: c.lat, lng: c.lng });
      });
    }

    if (mode === 'tracking') {
      L.marker([center.lat, center.lng], { icon: pinIcon }).addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      masterMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== 'tracking' || !mapRef.current || !masterPosition) return;
    if (!masterMarkerRef.current) {
      masterMarkerRef.current = L.marker([masterPosition.lat, masterPosition.lng], { icon: masterIcon }).addTo(mapRef.current);
    } else {
      masterMarkerRef.current.setLatLng([masterPosition.lat, masterPosition.lng]);
    }
  }, [mode, masterPosition]);

  if (mode === 'pulse') {
    return (
      <div style={{ height }} className={`relative overflow-hidden rounded-lg bg-fill ${className}`}>
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/25" />
          <div className="relative size-4.5 rounded-full border-[3px] border-surface bg-primary shadow-card" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className={`overflow-hidden rounded-lg ${className}`} />;
}
