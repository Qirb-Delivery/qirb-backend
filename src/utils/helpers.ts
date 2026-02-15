import jwt from 'jsonwebtoken';

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
};

export const generateOTP = (): string => {
  // In development, always return 123456
  if (process.env.NODE_ENV === 'development') {
    return '123456';
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateDeliveryOTP = (): string => {
  // 4-digit OTP for delivery verification
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const generateOrderNumber = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'HAB-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatETB = (amount: number): string => {
  return `${amount.toFixed(2)} ETB`;
};

export const isValidEthiopianPhone = (phone: string): boolean => {
  // Ethiopian phone: +251 followed by 9 digits starting with 7 or 9
  const regex = /^\+251[79]\d{8}$/;
  return regex.test(phone);
};

// ============ GEOFENCE UTILITIES ============

/**
 * Calculate distance between two GPS points using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a point (lat, lng) is inside a circular geofence.
 */
export function isPointInZone(
  pointLat: number, pointLng: number,
  centerLat: number, centerLng: number,
  radiusKm: number
): boolean {
  return haversineDistanceKm(pointLat, pointLng, centerLat, centerLng) <= radiusKm;
}

/**
 * Find the matching active delivery zone for given coordinates.
 * Returns the best (closest center) active zone, or null if none match.
 */
export function findMatchingZone<T extends {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
  isActive: boolean;
}>(lat: number, lng: number, zones: T[]): T | null {
  let bestZone: T | null = null;
  let bestDistance = Infinity;

  for (const zone of zones) {
    if (!zone.isActive || zone.centerLat == null || zone.centerLng == null) continue;
    const dist = haversineDistanceKm(lat, lng, zone.centerLat, zone.centerLng);
    if (dist <= zone.radiusKm && dist < bestDistance) {
      bestDistance = dist;
      bestZone = zone;
    }
  }

  return bestZone;
}
