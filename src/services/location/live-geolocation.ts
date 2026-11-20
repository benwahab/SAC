export interface EphemeralPreciseLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly capturedAt: number;
}

export type GeolocationFailure =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "position_invalid";

export interface PreciseLocationCallbacks {
  onPosition(position: EphemeralPreciseLocation): void;
  onError(reason: GeolocationFailure): void;
  onClear?(): void;
}

export interface GeolocationPort {
  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): number;
  clearWatch(watchId: number): void;
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

function mapGeolocationError(error: GeolocationPositionError): GeolocationFailure {
  if (error.code === 1) return "permission_denied";
  if (error.code === 2) return "position_unavailable";
  if (error.code === 3) return "timeout";
  return "position_unavailable";
}

/**
 * Starts a fresh, high-accuracy GPS watch. Coordinates exist only in the
 * callback's memory; this service does not write to IndexedDB, D1, Cache,
 * localStorage, logs, or any other persistent store.
 */
export function startPreciseLocationWatch(
  geolocation: GeolocationPort,
  callbacks: PreciseLocationCallbacks,
  options: PositionOptions = DEFAULT_OPTIONS,
): { stop(): void } {
  let stopped = false;
  let watchId: number | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (watchId !== null) {
      geolocation.clearWatch(watchId);
      watchId = null;
    }
    callbacks.onClear?.();
  };

  try {
    watchId = geolocation.watchPosition(
      (position) => {
        if (stopped) return;
        const { latitude, longitude, accuracy } = position.coords;
        const capturedAt = position.timestamp;
        if (
          !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0 ||
          !Number.isFinite(capturedAt) || capturedAt <= 0
        ) {
          callbacks.onError("position_invalid");
          return;
        }
        callbacks.onPosition({ latitude, longitude, accuracy, capturedAt });
      },
      (error) => {
        if (stopped) return;
        const reason = mapGeolocationError(error);
        callbacks.onError(reason);
        if (reason === "permission_denied") stop();
      },
      { ...DEFAULT_OPTIONS, ...options },
    );
  } catch {
    callbacks.onError("position_unavailable");
  }

  return { stop };
}

export function startBrowserPreciseLocationWatch(
  callbacks: PreciseLocationCallbacks,
  options: PositionOptions = DEFAULT_OPTIONS,
): { stop(): void } {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    callbacks.onError("position_unavailable");
    return { stop() {} };
  }
  return startPreciseLocationWatch(navigator.geolocation, callbacks, options);
}
