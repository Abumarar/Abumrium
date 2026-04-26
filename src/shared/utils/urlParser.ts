import { DEFAULT_SETTINGS } from '../../shared/constants'

/**
 * Smart URL parser for the address bar.
 * Priority order:
 * 1. abumrium:// internal routes → pass through
 * 2. localhost / private IPs with optional port/path → http://
 * 3. Full URLs (http/https) → pass through
 * 4. domain.tld with optional port/path → https://
 * 5. Anything else → search engine
 */
export function parseAddressBarInput(input: string, searchEngine?: string): string {
  const raw = input.trim()
  if (!raw) return 'abumrium://home'

  // Already an internal abumrium route
  if (raw.startsWith('abumrium://')) return raw

  // Already a full URL
  if (/^https?:\/\//i.test(raw)) return raw

  // localhost (with or without port and path)
  if (/^localhost(:\d+)?([/?#].*)?$/i.test(raw)) return `http://${raw}`

  // IPv4 addresses, with local/private addresses defaulting to http.
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?([/?#].*)?$/.test(raw)) {
    const [host] = raw.split(/[/:?#]/)
    const isLocal =
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    return `${isLocal ? 'http' : 'https'}://${raw}`
  }

  // Looks like a domain (e.g. example.com, github.com/user)
  if (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(raw)) return `https://${raw}`

  // Fallback: search
  const engine = searchEngine ?? DEFAULT_SETTINGS.searchEngine
  return `${engine}${encodeURIComponent(raw)}`
}

/** Returns true if the URL is a web page (not an internal route) */
export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
