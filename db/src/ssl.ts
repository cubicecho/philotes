/** The query parameter that states the TLS mode outright. */
const SSL_MODE_PARAM = 'sslmode';
/** Host name endings that only resolve on a private network. */
const PRIVATE_SUFFIXES = ['.lan', '.local', '.internal', '.home.arpa'];
/** IPv4 loopback, RFC 1918 and link-local ranges. */
const PRIVATE_IPV4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
/** IPv6 loopback, unique local (fc00::/7) and link-local (fe80::/10). */
const PRIVATE_IPV6 = /^(::1$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/;

/**
 * Whether a host is this machine or on a private network.
 *
 * @param hostname - The host from the URL, lower case, without IPv6 brackets.
 * @returns true for localhost, a dotless name such as a compose service, a private address or a private suffix.
 */
export function isPrivateHost(hostname: string): boolean {
  const isIpv6 = hostname.includes(':');
  if (isIpv6) {
    return PRIVATE_IPV6.test(hostname);
  }
  const isDotless = hostname.includes('.') === false;
  const hasPrivateSuffix = PRIVATE_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  return isDotless || hasPrivateSuffix || PRIVATE_IPV4.test(hostname);
}

/**
 * Whether a Postgres URL needs TLS forced on. Someone hosting on their own network must not need certificates.
 *
 * @param url - Connection URL.
 * @returns false for an explicit sslmode or a private or local host.
 */
export function requiresSsl(url: string): boolean {
  const parsed = new URL(url);
  if (parsed.searchParams.has(SSL_MODE_PARAM)) {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return isPrivateHost(hostname) === false;
}
