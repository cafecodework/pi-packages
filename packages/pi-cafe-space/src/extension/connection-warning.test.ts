import { describe, expect, it } from "vitest";
import { CONNECTION_WARNING_INTERVAL_MS, ConnectionWarningReporter, ConnectionWarningThrottle } from "./connection-warning.js";

describe("connection warning throttle", () => {
  it("allows the first warning, suppresses repeats during the interval, and resets", () => {
    const throttle = new ConnectionWarningThrottle();
    const first = 10_000;

    expect(throttle.allow(first)).toBe(true);
    expect(throttle.allow(first + 1)).toBe(false);
    expect(throttle.allow(first + CONNECTION_WARNING_INTERVAL_MS - 1)).toBe(false);
    expect(throttle.allow(first + CONNECTION_WARNING_INTERVAL_MS)).toBe(true);

    throttle.reset();
    expect(throttle.allow(first + 2)).toBe(true);
  });

  it("keeps one warning window across failed retry attempts", () => {
    const throttle = new ConnectionWarningThrottle();
    const first = 50_000;

    expect(throttle.allow(first)).toBe(true);
    // A disconnect/retry does not call reset(); all failures in this episode
    // remain suppressed until the interval has elapsed.
    expect(throttle.allow(first + 500)).toBe(false);
    expect(throttle.allow(first + 9_999)).toBe(false);
    expect(throttle.allow(first + CONNECTION_WARNING_INTERVAL_MS - 1)).toBe(false);
    expect(throttle.allow(first + CONNECTION_WARNING_INTERVAL_MS)).toBe(true);
  });

  it("does not disable throttling when the clock value is invalid", () => {
    const throttle = new ConnectionWarningThrottle();

    expect(throttle.allow(Number.NaN)).toBe(false);
    expect(throttle.allow(20_000)).toBe(true);
    expect(throttle.allow(Number.POSITIVE_INFINITY)).toBe(false);
    expect(throttle.allow(20_001)).toBe(false);
  });

  it("starts a bounded warning window after the wall clock moves backwards", () => {
    const throttle = new ConnectionWarningThrottle();

    expect(throttle.allow(100_000)).toBe(true);
    expect(throttle.allow(10_000)).toBe(true);
    expect(throttle.allow(10_001)).toBe(false);
    expect(throttle.allow(10_000 + CONNECTION_WARNING_INTERVAL_MS)).toBe(true);
  });

  it("covers construction, error, close, retry, stop, and welcome lifecycle paths", () => {
    const warnings: string[] = [];
    const reporter = new ConnectionWarningReporter((message) => warnings.push(message));
    const first = 100_000;

    // The three user-visible failure paths share one warning window. Repeated
    // exponential-backoff retries do not reset it.
    expect(reporter.report("relay connection could not be created: ECONNREFUSED", first)).toBe(true);
    expect(reporter.report("relay connection: ECONNREFUSED", first + 500)).toBe(false);
    expect(reporter.report("relay connection closed (1006)", first + 1_500)).toBe(false);
    expect(reporter.report("relay connection could not be created: ECONNREFUSED", first + 9_500)).toBe(false);
    expect(warnings).toEqual(["relay connection could not be created: ECONNREFUSED"]);

    // A successful authenticated welcome begins a new episode.
    reporter.onAuthenticatedWelcome();
    expect(reporter.report("relay connection closed (1006)", first + 10_000)).toBe(true);
    // Failed retries still remain in that same episode.
    expect(reporter.report("relay connection: ECONNREFUSED", first + 10_001)).toBe(false);

    // Explicit stop also starts a fresh lifecycle; a failed close before it
    // must not have reset the window on its own.
    reporter.onExplicitStop();
    expect(reporter.report("relay connection: ECONNREFUSED", first + 20_000)).toBe(true);
    expect(reporter.report("relay connection closed (1006)", first + 20_001)).toBe(false);
    reporter.onExplicitStop();
    expect(reporter.report("relay connection could not be created: ECONNREFUSED", first + 20_002)).toBe(true);

    expect(warnings).toHaveLength(4);
  });
});
