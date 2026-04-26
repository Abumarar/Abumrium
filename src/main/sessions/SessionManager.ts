/**
 * SessionManager — manages Electron session partitions for container isolation.
 * Each container uses a separate named partition, ensuring cookies/storage
 * do not leak between sessions.
 *
 * Security note: partitions starting with 'persist:' survive app restarts.
 * The 'guest' container uses a non-persistent (in-memory) partition.
 */
import { session } from 'electron'
import { CONTAINERS } from '../../shared/constants'
import type { ContainerId } from '../../shared/types'

export class SessionManager {
  private static instance: SessionManager
  static getInstance(): SessionManager {
    if (!SessionManager.instance) SessionManager.instance = new SessionManager()
    return SessionManager.instance
  }

  /** Return the Electron session for a given container */
  getSession(containerId: ContainerId): Electron.Session {
    const container = CONTAINERS.find(c => c.id === containerId)
    if (!container) throw new Error(`Unknown container: ${containerId}`)
    return session.fromPartition(container.partition)
  }

  /** Initialize all container sessions with secure defaults */
  async initAll(): Promise<void> {
    for (const container of CONTAINERS) {
      const sess = session.fromPartition(container.partition)

      // Set a custom user-agent suffix to identify container
      const ua = sess.getUserAgent()
      sess.setUserAgent(`${ua} AbumriumContainer/${container.id}`)

      // Security: disable spell check in partition sessions (optional)
      // sess.setSpellCheckerEnabled(false)
    }
  }

  /** Clear all data for a container */
  async clearContainer(containerId: ContainerId): Promise<void> {
    const sess = this.getSession(containerId)
    await sess.clearStorageData()
    await sess.clearCache()
    console.log(`[sessions] Cleared data for container: ${containerId}`)
  }
}
