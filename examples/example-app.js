// Example: mount the Environment Factory router in a minimal Express app.
//
// Run it with:
//
//     export AUTONOMA_SHARED_SECRET="replace-with-a-real-secret"
//     export DATABASE_URL="postgres://user:pass@localhost:5432/mydb"
//     node examples/example-app.js
//
// Then point Autonoma at http://localhost:3000/environment-factory. The
// specs in src/ are library code — this file shows how to wire them up.

import express from "express";
import environmentFactory from "../src/environment-factory.js";

const app = express();

// Any other middleware your app uses (logging, auth, etc.) goes here.
// Note: do NOT mount a global express.json() before the factory router —
// the router installs its own raw-body-capturing parser internally so
// HMAC verification sees the original bytes.

app.use("/environment-factory", environmentFactory);

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Environment Factory listening on http://localhost:${port}`);
  console.log(`  POST /environment-factory      (Autonoma lifecycle endpoint)`);
  console.log(`  GET  /health                   (liveness probe)`);
});
