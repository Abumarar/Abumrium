/**
 * HeaderRules — injects custom request headers per domain using Electron's
 * webRequest API.
 *
 * Security notes:
 * - Rules are only applied to web page requests, not to the renderer shell.
 * - Sensitive header names (Authorization, Cookie) are flagged in the UI with a warning.
 * - We never log Authorization or Cookie header values.
 * - Rules are user-created and explicitly opt-in.
 */
import { session } from 'electron'
import type { HeaderRule } from '../../shared/types'
import { CONTAINERS, isSensitiveHeader } from '../../shared/constants'
import { normalizeHeaderRules, normalizeRuleDomain } from '../../shared/utils/settingsValidation'

export class HeaderRulesManager {
  private static instance: HeaderRulesManager
  private rules: HeaderRule[] = []

  static getInstance(): HeaderRulesManager {
    if (!HeaderRulesManager.instance) HeaderRulesManager.instance = new HeaderRulesManager()
    return HeaderRulesManager.instance
  }

  setRules(rules: HeaderRule[]): void {
    this.rules = normalizeHeaderRules(rules)
  }

  getRules(): HeaderRule[] {
    return this.rules
  }

  /** Attach webRequest listeners to all container sessions */
  installListeners(): void {
    for (const container of CONTAINERS) {
      const sess = session.fromPartition(container.partition)
      sess.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
        const requestHeaders = { ...details.requestHeaders }
        for (const rule of this.rules) {
          if (!rule.enabled) continue
          // Match by domain (host comparison)
          try {
            const url = new URL(details.url)
            const ruleHost = normalizeRuleDomain(rule.domain)
            if (url.host !== ruleHost && !url.host.endsWith(`.${ruleHost}`)) continue
            // SECURITY: log rule application but not sensitive values
            if (!isSensitiveHeader(rule.headerName)) {
              console.log(`[headers] Injecting ${rule.headerName} for ${url.host}`)
            }
            requestHeaders[rule.headerName] = rule.headerValue
          } catch { continue }
        }
        callback({ requestHeaders })
      })
    }
  }
}
