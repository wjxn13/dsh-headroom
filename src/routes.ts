/**
 * dsh-headroom HTTP routes: the browser half's data plane.
 *
 * WHY A CUSTOM ROUTE (same escape hatch as dsh-headroom-manager):
 * The desktop client's origin is the custom protocol `dsh-app://app`, and the
 * Headroom proxy only echoes Access-Control-Allow-Origin for http/https
 * origins — so the panel's direct fetches to http://127.0.0.1:8787 are blocked
 * by CORS in the desktop app (the web profile happens to work because its
 * origin is http://127.0.0.1:*). Rather than weakening the proxy's CORS, the
 * HOST fetches 8787 (server-side, no CORS) and serves the result on its own
 * webServer, which the browser reads same-origin:
 *
 *   GET /headroom/status — { running, version, port, stats }
 *
 * Read-only by design: process lifecycle belongs to dsh-headroom-manager
 * (/headroom-mgr/start|stop), and route switching goes through the settings
 * config form. No origin check needed for a pure read.
 */
import { request as httpRequest } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { HEADROOM_LIVEZ_URL, HEADROOM_PORT } from './constants.ts'

/** Structural face of the host webServer this module needs (dsh-host-webserver). */
export interface HeadroomWebServer {
  register(route: { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }): () => void
}

/** GET http://127.0.0.1:8787/livez — undefined when the proxy is down. */
function fetchJson(url: string, timeoutMs = 3000): Promise<unknown | undefined> {
  return new Promise((resolve) => {
    const req = httpRequest(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {
          resolve(undefined)
        }
      })
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(undefined)
    })
    req.on('error', () => resolve(undefined))
    req.end()
  })
}

/**
 * Probe the proxy and collect the panel payload in one round trip:
 * `running`/`version` come from /livez, `stats` is the raw /stats body the
 * client's stats.ts knows how to project (null when the proxy is down).
 */
async function status(): Promise<Record<string, unknown>> {
  const livez = await fetchJson(HEADROOM_LIVEZ_URL) as { version?: string } | undefined
  const running = livez !== undefined
  const stats = running
    ? await fetchJson(`http://127.0.0.1:${HEADROOM_PORT}/stats`) ?? null
    : null
  return {
    running,
    version: livez?.version,
    port: HEADROOM_PORT,
    stats,
  }
}

function sendJson(response: ServerResponse, code: number, body: unknown): void {
  response.writeHead(code, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

/**
 * Mount GET /headroom/status on the host webServer.
 * @param webServer - the host webServer service (pass via ctx.inject, never a
 *   sync ctx.get — apply() can run before the service starts and the mount
 *   would silently never happen).
 * @returns disposer removing the route.
 */
export function mountHeadroomRoutes(webServer: HeadroomWebServer): () => void {
  return webServer.register({
    kind: 'exact',
    path: '/headroom/status',
    handler: (_request, response) => {
      void status().then(
        (body) => sendJson(response, 200, body),
        () => sendJson(response, 502, { error: 'status collection failed' }),
      )
    },
  })
}
