import assert from "node:assert/strict";
import test from "node:test";
import {
  startPreciseLocationWatch,
  type PreciseLocationCallbacks,
} from "../src/services/location/live-geolocation.ts";

class FakeGeolocation {
  success: PositionCallback | null = null;
  failure: PositionErrorCallback | null = null;
  cleared: number[] = [];
  options: PositionOptions | undefined;
  watchPosition(success: PositionCallback, failure?: PositionErrorCallback | null, options?: PositionOptions) {
    this.success = success;
    this.failure = failure ?? null;
    this.options = options;
    return 42;
  }
  clearWatch(id: number) { this.cleared.push(id); }
  emit(latitude: number, longitude: number, accuracy = 5, timestamp = 123456) {
    this.success?.({
      coords: { latitude, longitude, accuracy } as GeolocationCoordinates,
      timestamp,
    } as GeolocationPosition);
  }
}

test("requests a fresh high-accuracy GPS fix and forwards only the current fix", () => {
  const geo = new FakeGeolocation();
  const positions: unknown[] = [];
  const errors: string[] = [];
  const callbacks: PreciseLocationCallbacks = {
    onPosition: (position) => positions.push(position),
    onError: (reason) => errors.push(reason),
  };

  const watch = startPreciseLocationWatch(geo, callbacks);
  assert.equal(geo.options?.enableHighAccuracy, true);
  assert.equal(geo.options?.maximumAge, 0);
  assert.equal(geo.options?.timeout, 15000);

  geo.emit(13.5, 2.1, 4, 123456);
  assert.deepEqual(positions, [{
    latitude: 13.5,
    longitude: 2.1,
    accuracy: 4,
    capturedAt: 123456,
  }]);
  assert.deepEqual(errors, []);
  watch.stop();
  assert.deepEqual(geo.cleared, [42]);
});

test("does not forward positions after stop and stop is idempotent", () => {
  const geo = new FakeGeolocation();
  let received = 0;
  let cleared = 0;
  const watch = startPreciseLocationWatch(geo, {
    onPosition: () => { received += 1; },
    onError: () => undefined,
    onClear: () => { cleared += 1; },
  });
  watch.stop();
  watch.stop();
  geo.emit(13.5, 2.1);
  assert.equal(received, 0);
  assert.equal(cleared, 1);
  assert.deepEqual(geo.cleared, [42]);
});

test("rejects invalid coordinates and reports geolocation permission errors", () => {
  const geo = new FakeGeolocation();
  const errors: string[] = [];
  const watch = startPreciseLocationWatch(geo, {
    onPosition: () => assert.fail("invalid coordinates must not be emitted"),
    onError: (reason) => errors.push(reason),
  });
  geo.emit(999, 2.1);
  assert.deepEqual(errors, ["position_invalid"]);
  geo.failure?.({ code: 1 } as GeolocationPositionError);
  assert.deepEqual(errors, ["position_invalid", "permission_denied"]);
  assert.deepEqual(geo.cleared, [42]);
  watch.stop();
});

test("uses no persisted storage and supports explicit cleanup after SOS closure", () => {
  const geo = new FakeGeolocation();
  let lastPosition: unknown = null;
  const watch = startPreciseLocationWatch(geo, {
    onPosition: (position) => { lastPosition = position; },
    onError: () => undefined,
    onClear: () => { lastPosition = null; },
  });
  geo.emit(13.5, 2.1);
  assert.ok(lastPosition);
  watch.stop();
  assert.equal(lastPosition, null);
  assert.deepEqual(geo.cleared, [42]);
});
