// Middleware: verify the HMAC-SHA256 signature Autonoma sends with every
// Environment Factory request.
//
// Autonoma signs the raw request body with a shared secret and sends the
// hex-encoded digest in the `X-Autonoma-Signature` header. We recompute the
// same digest on our side and reject the request if they don't match.
//
// IMPORTANT: this middleware requires access to the *raw* request body
// (a Buffer), not the parsed JSON. Mount `express.json({ verify })` earlier
// in the chain to capture `req.rawBody` before JSON parsing happens. See
// environment-factory.js for the full wiring.

import crypto from "node:crypto";

const SIGNATURE_HEADER = "x-autonoma-signature";

export function verifySignature(req, res, next) {
  const secret = process.env.AUTONOMA_SHARED_SECRET;
  if (!secret) {
    // Fail closed: without a secret configured, we cannot verify anything.
    return res.status(500).json({
      error: "AUTONOMA_SHARED_SECRET is not configured on the server",
    });
  }

  const provided = req.get(SIGNATURE_HEADER);
  if (!provided) {
    return res.status(401).json({ error: "Missing X-Autonoma-Signature header" });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    // If rawBody isn't captured, the upstream JSON middleware wasn't configured
    // with a `verify` hook — signature verification is impossible.
    return res.status(500).json({
      error: "Raw request body is unavailable; configure express.json({ verify })",
    });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Compare in constant time to avoid timing-based leaks of the digest.
  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  return next();
}

export default verifySignature;
