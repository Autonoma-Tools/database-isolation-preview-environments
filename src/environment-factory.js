// Environment Factory router.
//
// Mount this router at POST /environment-factory (or wherever you've told
// Autonoma to reach you). Every request Autonoma sends has an `operation`
// field that tells us which lifecycle step to run:
//
//     { "operation": "discover" }                                 -> list scenarios
//     { "operation": "up",   "runId": "...", "scenario": "..." }  -> seed data
//     { "operation": "down", "runId": "..." }                     -> tear it all down
//
// Every request is authenticated via HMAC-SHA256 over the raw body — see
// ./verify-signature.js for the middleware. If the signature is missing or
// wrong, the request is rejected before it reaches any handler.

import express from "express";
import { verifySignature } from "./verify-signature.js";
import {
  handleDiscover,
  handleUp,
  handleDown,
} from "./handlers.js";

// ---------------------------------------------------------------------------
// JSON parsing with a raw-body side-channel
// ---------------------------------------------------------------------------
// express.json() consumes the body stream; by the time a route handler runs,
// the original bytes are gone. That's a problem for HMAC verification, which
// must run against the *exact* bytes the sender signed. The `verify` callback
// here stashes the raw Buffer on req.rawBody so verifySignature can read it.
const jsonWithRawBody = express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
async function dispatch(req, res) {
  const operation = req.body?.operation;

  switch (operation) {
    case "discover":
      return handleDiscover(req, res);
    case "up":
      return handleUp(req, res);
    case "down":
      return handleDown(req, res);
    default:
      return res.status(400).json({
        error: `Unknown or missing 'operation' field: ${operation ?? "<none>"}`,
        expected: ["discover", "up", "down"],
      });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// Compose the router as: raw-body-capturing JSON parser -> HMAC check ->
// dispatcher. Mounting order matters; keep it this way so signatures are
// verified against the original bytes before any handler touches req.body.
const router = express.Router();

router.post("/", jsonWithRawBody, verifySignature, dispatch);

export default router;
export { dispatch };
