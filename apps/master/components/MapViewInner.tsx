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
  /** Высота в px. `null` — высоту задаёт CSS (нужно для адаптивной раскладки). */
  height?: number | null;
  className?: string;
}

function divIcon(html: string, size: number) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size] });
}

/*
 * Маркеры Leaflet рисуются строкой HTML вне дерева React, поэтому классы
 * Tailwind сюда не доезжают — цвета берём напрямую из CSS-переменных токенов,
 * а не хардкодим hex. Эмодзи машины заменено на ту же обводочную иконку, что и
 * в остальном интерфейсе.
 */
const pinIcon = divIcon(
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--color-primary);transform:rotate(-45deg);box-shadow:0 2px 6px rgb(15 23 42 / 0.35)"></div>',
  22,
);

const CAR_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M5 17h14M4 17v-4l2-5h12l2 5v4M4 17v2h3v-2M17 17v2h3v-2"/>' +
  '<circle cx="8" cy="13.5" r="1"/><circle cx="16" cy="13.5" r="1"/></svg>';

const masterIcon = L.divIcon({
  className: '',
  html:
    '<div style="width:30px;height:30px;border-radius:50%;background:var(--color-surface);' +
    'border:3px solid var(--color-primary);display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 2px 8px rgb(15 23 42 / 0.3)">' +
    CAR_SVG +
    '</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapViewInner({ mode, center, onCenterChange, masterPosition, height = 220, className = '' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const masterMarkerRef = useRef<L.Marker | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  // height === null — высоту задаёт CSS: инлайновый стиль перебил бы классы.
  const style = height == null ? undefined : { height };

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
      <div style={style} className={`relative overflow-hidden rounded-lg bg-fill ${className}`}>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/25" />
          <div className="relative h-4.5 w-4.5 rounded-full border-4 border-surface bg-primary shadow-card" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={style} className={`overflow-hidden rounded-lg ${className}`} />;
}
