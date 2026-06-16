export interface GeoInfo {
  country: string
  org: string
  lat: number | null
  lon: number | null
}

const cache = new Map<string, GeoInfo>()
const pending = new Set<string>()

function isPrivate(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === "::1" ||
    ip.startsWith("fe80") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  )
}

// Returns geo info, or null for a transient failure (left uncached so a
// later sample retries). Definitive misses are cached as empty fields.
async function fetchGeo(ip: string): Promise<GeoInfo | null> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,lat,lon,org,isp`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      countryCode?: string
      lat?: number
      lon?: number
      org?: string
      isp?: string
    }
    if (data.status !== "success") return { country: "", org: "", lat: null, lon: null }
    return {
      country: data.countryCode ?? "",
      org: data.org || data.isp || "",
      lat: data.lat ?? null,
      lon: data.lon ?? null,
    }
  } catch {
    return null
  }
}

// Fire-and-forget like the DNS cache: the first sample shows nothing and
// later samples pick the info up from the cache.
export function lookupGeo(ip: string): GeoInfo | undefined {
  if (!ip || ip.includes("*") || isPrivate(ip)) return undefined
  const cached = cache.get(ip)
  if (cached) return cached
  if (!pending.has(ip)) {
    pending.add(ip)
    fetchGeo(ip)
      .then((geo) => {
        if (geo) cache.set(ip, geo)
      })
      .finally(() => pending.delete(ip))
  }
  return undefined
}
