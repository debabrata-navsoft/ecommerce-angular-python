import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// const win = domino.createWindow(template);
// global['window'] = win;
// global['document'] = win.document;
// global['navigator'] = win.navigator;
// global['localStorage'] = localStorage;
// global['getComputedStyle'] = win.getComputedStyle;
// global['IDBIndex'] = win.IDBIndex;

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 *
 * The render is session-aware: ApiService forwards the incoming `Cookie` to the API, so
 * the HTML reflects who is signed in and Angular's transfer cache embeds that user in the
 * page. That makes each response **user-specific**, so it must never be stored by a
 * shared cache — a CDN or proxy hit would serve one visitor's account to another.
 */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Vary', 'Cookie');

  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI, for the dev-server and during the build.
 * Required — `ng serve` looks for this export.
 */
export const reqHandler = createNodeRequestHandler(app);
