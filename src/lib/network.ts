import type { FastifyRequest } from 'fastify';
import type { SettingsService } from '../services/settings.js';

/**
 * Returns true if the given IP address is in a private RFC1918 range,
 * loopback, or link-local range.
 */
export function isPrivateIp(rawIp: string): boolean {
  if (!rawIp) return false;
  const ip = rawIp.replace(/^::ffff:/, '').trim();

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;

  // IPv6 Loopback
  if (ip === '::1' || ip === 'localhost') return true;

  // RFC 1918 Class A: 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;

  // RFC 1918 Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  const bMatch = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (bMatch && bMatch[1]) {
    const octet = parseInt(bMatch[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  // RFC 1918 Class C: 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;

  // Link-local: 169.254.0.0/16
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;

  // IPv6 Link-local fe80::/10
  if (/^fe80:/i.test(ip)) return true;

  // IPv6 Unique Local Address fc00::/7 (fc00:: - fdff:...)
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;

  return false;
}

/**
 * Returns true if the given IP address is within Tailscale's CGNAT range (100.64.0.0/10)
 * or Tailscale IPv6 ULA (fd7a:115c:a1e0::/48).
 */
export function isTailscaleIp(rawIp: string): boolean {
  if (!rawIp) return false;
  const ip = rawIp.replace(/^::ffff:/, '').trim();
  const match = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (match && match[1]) {
    const octet = parseInt(match[1], 10);
    if (octet >= 64 && octet <= 127) return true;
  }
  if (/^fd7a:115c:a1e0:/i.test(ip)) return true;
  return false;
}

/**
 * Determines whether the incoming request originates from the local network (LAN)
 * or local machine, as opposed to reaching the server via the public internet (e.g. reverse proxy, tunnel, or custom domain).
 */
export function isLanRequest(
  request: FastifyRequest,
  settings?: SettingsService,
  allowTailscale = false
): boolean {
  const headers = request.headers;

  // 1. Edge proxy headers (e.g. Cloudflare Tunnel, reverse proxies) indicate public internet transit.
  // Cloudflare always sets cf-connecting-ip, cf-ray, and cf-visitor on tunnel requests.
  if (headers['cf-connecting-ip'] || headers['cf-ray'] || headers['cf-visitor']) {
    return false;
  }

  // 2. Check if the request's Host header matches the configured public domain.
  if (settings) {
    try {
      const publicBase = settings.baseUrl;
      if (publicBase) {
        const publicHost = new URL(publicBase).hostname.toLowerCase();
        const rawReqHost = headers.host || '';
        const reqHost = (rawReqHost.split(':')[0] ?? '').toLowerCase();
        // If publicHost is not a private IP / localhost and matches the incoming request host
        if (publicHost && !isPrivateIp(publicHost) && publicHost !== 'localhost' && !publicHost.endsWith('.local') && !publicHost.endsWith('.lan')) {
          if (reqHost === publicHost) {
            return false;
          }
        }
      }
    } catch {
      // ignore URL parse errors
    }
  }

  // 3. Check client IP (request.ip resolved by Fastify trustProxy or socket remoteAddress)
  const clientIp = request.ip || request.socket?.remoteAddress || '';
  if (isPrivateIp(clientIp)) return true;
  if (allowTailscale && isTailscaleIp(clientIp)) return true;

  // 4. Check x-forwarded-for if behind a local LAN reverse proxy
  const xForwardedFor = headers['x-forwarded-for'];
  if (xForwardedFor) {
    const raw = Array.isArray(xForwardedFor) ? xForwardedFor.join(',') : xForwardedFor;
    const clientFirst = (raw.split(',')[0] ?? '').trim();
    if (isPrivateIp(clientFirst)) return true;
    if (allowTailscale && isTailscaleIp(clientFirst)) return true;
    return false;
  }

  return false;
}
