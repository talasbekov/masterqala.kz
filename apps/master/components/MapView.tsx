'use client';
import dynamic from 'next/dynamic';

export type { LatLng } from './MapViewInner';

const MapView = dynamic(() => import('./MapViewInner'), { ssr: false });

export default MapView;
