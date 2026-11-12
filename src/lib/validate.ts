const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;
const LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

/**
 * Validates an IP address or domain name and returns a user facing error,
 * or `null` when the value is acceptable.
 */
export function validateHost(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Host is required";
  if (value.length > 253) return "Host is too long";
  if (/\s/.test(value)) return "Host cannot contain spaces";
  if (value.includes("://")) return "Enter only the IP address or domain, without a protocol";
  if (/[/\\?#]/.test(value)) return "Enter only the IP address or domain, without a path";

  const host = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;

  if (host.includes(":")) {
    const groups = host.split("::");
    if (host.includes("::") && groups.length > 2) return "Invalid IPv6 address";
    if (!IPV6.test(host) || (!host.includes("::") && host.split(":").length !== 8)) {
      return "Invalid IPv6 address";
    }
    return null;
  }

  if (IPV4.test(host)) return null;

  if (!host.includes(".")) {
    // Allow single label LAN names such as "router" or "localhost".
    return LABEL.test(host) ? null : "Invalid host name";
  }

  const labels = host.split(".");
  if (labels.some((l) => !LABEL.test(l))) return "Invalid domain name";
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return "Invalid domain name";
  return null;
}

export const normalizeHost = (host: string): string => host.trim().toLowerCase();
