export const CONNECTION_WARNING_INTERVAL_MS = 60_000;

/**
 * Limits repeated connection-failure notifications without changing the
 * connector's retry/backoff behavior or its status-bar state.
 */
export class ConnectionWarningThrottle {
  private lastWarningAt: number | null = null;

  allow(now = Date.now()): boolean {
    if (!Number.isFinite(now)) return false;
    if (this.lastWarningAt !== null) {
      const elapsed = now - this.lastWarningAt;
      if (elapsed >= 0 && elapsed < CONNECTION_WARNING_INTERVAL_MS) return false;
      // A wall-clock correction must not suppress warnings until the old
      // timestamp eventually catches up. Start one fresh bounded window at
      // the corrected time instead.
    }
    this.lastWarningAt = now;
    return true;
  }

  reset(): void {
    this.lastWarningAt = null;
  }
}

/**
 * Owns the warning lifecycle separately from socket status/reconnect state.
 * Failed construction, error, and close transitions all share one window;
 * only an explicit stop or an authenticated welcome starts a new episode.
 */
export class ConnectionWarningReporter {
  private readonly throttle = new ConnectionWarningThrottle();

  constructor(private readonly notify: (message: string) => void) {}

  report(message: string, now = Date.now()): boolean {
    if (!this.throttle.allow(now)) return false;
    try {
      this.notify(message);
    } catch {
      // A notification sink may belong to an invalidated Pi UI context. The
      // throttle state must still advance so a failing sink cannot be spammed.
    }
    return true;
  }

  reset(): void {
    this.throttle.reset();
  }

  onAuthenticatedWelcome(): void {
    this.reset();
  }

  onExplicitStop(): void {
    this.reset();
  }
}
