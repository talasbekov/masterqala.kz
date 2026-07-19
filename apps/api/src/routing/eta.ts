export const ASSUMED_SPEED_KMH = 30;

export function estimateEtaMinutes(distanceKm: number): number {
  return Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60);
}
