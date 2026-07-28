// Basic in-memory rate limiter, keyed by IP address.
//
// Honest limitation: Vercel serverless functions don't guarantee the same
// instance handles every request — under heavy traffic or after periods of
// inactivity, a "cold start" can spin up a fresh instance with empty memory,
// resetting these counts. For a portfolio project or moderate traffic, this
// still meaningfully blocks rapid abuse (most repeated requests in a short
// burst do hit the same warm instance). If you outgrow this later, swap it
// for Upstash Redis or Vercel KV, which track limits centrally across every
// instance.

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * @param {*} req - the incoming request
 * @param {string} routeKey - a name for this route, e.g. "chat" or "image"
 * @param {number} limit - max requests allowed per window
 * @param {number} windowMs - window size in milliseconds
 * @returns {{ allowed: boolean, retryAfterSeconds: number }}
 */
function checkRateLimit(req, routeKey, limit, windowMs) {
  const ip = getClientIp(req);
  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
  return { allowed: false, retryAfterSeconds };
}

module.exports = { checkRateLimit };
