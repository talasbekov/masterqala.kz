export interface LatLng {
  lat: number;
  lng: number;
}

export const ROUTING_SERVICE = Symbol('ROUTING_SERVICE');

export interface RoutingService {
  /** Расстояние по дорогам, км. */
  distanceKm(from: LatLng, to: LatLng): Promise<number>;
}
