/**
 * abumriumProtocol — registers the abumrium:// custom scheme.
 *
 * In the MVP, internal pages are rendered by the React SPA inside the main
 * BrowserWindow's own webContents. The TabManager detects abumrium:// URLs
 * and keeps them as internal route state rather than loading them in a WebContentsView.
 *
 * This file registers the scheme as privileged so it behaves like a standard
 * URL (fetch, CSP, etc.) and future protocol handlers can serve files from it.
 */
import { protocol, net } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

const SCHEME = 'abumrium'

/** Must be called BEFORE app.whenReady() — registers scheme privileges */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ])
}

/** Called AFTER app.whenReady() — installs the actual protocol handler */
export function installProtocolHandler(rendererDistPath: string): void {
  protocol.handle(SCHEME, (request) => {
    // All abumrium:// URLs serve the renderer's index.html
    // The React Router reads the URL to render the right page
    const indexPath = path.join(rendererDistPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      return net.fetch(`file://${indexPath}`)
    }
    return new Response('Internal page not found', { status: 404 })
  })
}
