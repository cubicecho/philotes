import { join } from 'node:path';
import express, { Router } from 'express';

/**
 * Serves the built app, answering any path that is not a file with index.html so the client
 * router can take it.
 *
 * @param staticDir - The built app's directory.
 * @returns The router, to mount last.
 */
export function createStaticHandler(staticDir: string): Router {
  const indexPath = join(staticDir, 'index.html');
  const router = Router();
  router.use(express.static(staticDir));
  router.get('/{*path}', (_req, res) => {
    res.sendFile(indexPath);
  });
  return router;
}
