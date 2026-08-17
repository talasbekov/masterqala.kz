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

function divIcon(html: string, size: number) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size] });
}

/*
 * Внутрь divIcon Leaflet кладёт сырой HTML — классы Tailwind туда не доходят,
 * поэтому цвета берём напрямую из CSS-переменных дизайн-системы: они объявлены
 * на :root и наследуются в DOM карты. Тени нейтральные, на основе --color-ink
 * (#0F172A): подставить переменную внутрь rgba() нельзя.
 */
const pinIcon = divIcon(
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--color-primary);transform:rotate(-45deg);box-shadow:0 2px 6px rgba(15,23,42,0.4)"></div>',
  22,
);

/** CarIcon из @masterqala/ui, развёрнутая в строку: React внутрь Leaflet не рендерит. */
const CAR_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)"' +
  ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="M4 16.5v-3l1.8-4.4A2 2 0 0 1 7.6 8h8.8a2 2 0 0 1 1.8 1.1L20 13.5v3"/>' +
  '<path d="M3 16.5h18M7 19.5v-3M17 19.5v-3"/></svg>';

const masterIcon = L.divIcon({
  className: '',
  html:
    '<div style="width:30px;height:30px;border-radius:50%;background:var(--color-surface);' +
    'border:3px solid var(--color-primary);display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 2px 8px rgba(15,23,42,0.3)">' +
    CAR_ICON_SVG +
    '</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapView({ mode, center, onCenterChange, masterPosition, height = 220, className = '' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const masterMarkerRef = useRef<L.Marker | null>(null);

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
        onCenterChange?.({ lat: c.lat, lng: c.lng });
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
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/25" />
          <div className="relative h-4.5 w-4.5 rounded-full border-[3px] border-surface bg-primary shadow-card" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className={`overflow-hidden rounded-lg ${className}`} />;
}
