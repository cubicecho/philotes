import type { Server } from 'node:http';
import { HTTP_DEFAULTS, type HttpSettings } from '../core/defaults.ts';
import { errorMessage } from '../core/errors.ts';
import { MS_PER_SECOND } from '../core/wire.ts';

/** What runs around the drain. */
export interface ShutdownSteps {
  /** Stops starting new work (timers, queue pollers). Runs as soon as the signal arrives. */
  before?: () => unknown;
  /** Closes what requests were using (the pool). Runs once the server has drained. */
  after?: () => Promise<unknown>;
}

/**
 * On SIGTERM or SIGINT: stops accepting, lets in-flight requests finish, closes, exits. A second signal exits at once.
 *
 * @param server - The listening server.
 * @param [steps] - Work to stop before the drain, and resources to close after it.
 * @param [overrides] - Settings that differ from `HTTP_DEFAULTS`. Only the two shutdown timings are read.
 */
export function stopOnSignals(
  server: Server,
  { before, after }: ShutdownSteps = {},
  overrides: Partial<HttpSettings> = {},
): void {
  const settings = { ...HTTP_DEFAULTS, ...overrides };
  const drainMs = settings.drainSeconds * MS_PER_SECOND;
  const deadlineMs = settings.shutdownDeadlineSeconds * MS_PER_SECOND;
  let isStopping = false;
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (isStopping) {
      process.exit(1);
    }
    isStopping = true;
    console.log(`[server] ${signal}: draining`);
    setTimeout(() => {
      console.error('[server] shutdown took too long, exiting');
      process.exit(1);
    }, deadlineMs).unref();
    try {
      await before?.();
      const drained = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeIdleConnections();
      // A request that never finishes on its own is cut once the drain time is up.
      const cutOff = setTimeout(() => server.closeAllConnections(), drainMs);
      await drained;
      clearTimeout(cutOff);
      await after?.();
    } catch (error) {
      console.error(`[server] shutdown failed: ${errorMessage(error)}`);
      process.exit(1);
    }
    console.log('[server] stopped');
    process.exit(0);
  };
  process.on('SIGTERM', (signal) => void stop(signal));
  process.on('SIGINT', (signal) => void stop(signal));
}
