// Environment Factory lifecycle handlers for a Postgres-backed application.
//
// The three handlers implement the Autonoma Environment Factory protocol:
//
//   - handleDiscover : advertises which scenarios this factory supports and
//                      what inputs each scenario needs.
//   - handleUp       : provisions run-scoped data for a given scenario and
//                      returns the entity IDs + auth token the test run will
//                      use.
//   - handleDown     : tears down every row tagged with the run's `runId`, in
//                      correct foreign-key order, so the database is left
//                      exactly as it was before the run started.
//
// Every row this factory inserts carries a `run_id` column. `handleDown` uses
// that column to delete precisely what the run created — nothing more, nothing
// less. This is what the blog post calls "run-scoped isolation on a shared
// database": cheap, fast, and safe as long as every insert is tagged.

import pkg from "pg";

const { Pool } = pkg;

// A single shared pool is fine; the factory is stateless between requests.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export async function handleDiscover(_req, res) {
  return res.json({
    scenarios: [
      {
        name: "checkout",
        description:
          "Seeds a user with a populated cart so a test can exercise the checkout flow end-to-end.",
        requirements: {
          inputs: [
            {
              name: "productSku",
              type: "string",
              required: true,
              description: "SKU of the product to place in the user's cart.",
            },
            {
              name: "quantity",
              type: "integer",
              required: false,
              default: 1,
            },
          ],
          outputs: ["userId", "cartId", "authToken"],
        },
      },
      {
        name: "subscription",
        description:
          "Seeds a user with an active subscription so a test can exercise billing, upgrades, and cancellation.",
        requirements: {
          inputs: [
            {
              name: "plan",
              type: "string",
              required: true,
              enum: ["starter", "pro", "enterprise"],
            },
          ],
          outputs: ["userId", "subscriptionId", "authToken"],
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Up
// ---------------------------------------------------------------------------

export async function handleUp(req, res) {
  const { runId, scenario, inputs = {} } = req.body ?? {};

  if (!runId || !scenario) {
    return res
      .status(400)
      .json({ error: "`runId` and `scenario` are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Every run gets a fresh user. Tag it with run_id so teardown can find it.
    const email = `autonoma+${runId}@example.test`;
    const userInsert = await client.query(
      `INSERT INTO users (email, display_name, run_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, `Autonoma Run ${runId}`, runId],
    );
    const userId = userInsert.rows[0].id;

    let payload;
    if (scenario === "checkout") {
      const productSku = inputs.productSku;
      const quantity = Number.isInteger(inputs.quantity) ? inputs.quantity : 1;
      if (!productSku) {
        throw new Error("scenario 'checkout' requires inputs.productSku");
      }

      const cartInsert = await client.query(
        `INSERT INTO carts (user_id, run_id)
         VALUES ($1, $2)
         RETURNING id`,
        [userId, runId],
      );
      const cartId = cartInsert.rows[0].id;

      await client.query(
        `INSERT INTO cart_items (cart_id, product_sku, quantity, run_id)
         VALUES ($1, $2, $3, $4)`,
        [cartId, productSku, quantity, runId],
      );

      payload = { userId, cartId };
    } else if (scenario === "subscription") {
      const plan = inputs.plan;
      if (!plan) {
        throw new Error("scenario 'subscription' requires inputs.plan");
      }

      const subInsert = await client.query(
        `INSERT INTO subscriptions (user_id, plan, status, run_id)
         VALUES ($1, $2, 'active', $3)
         RETURNING id`,
        [userId, plan, runId],
      );
      const subscriptionId = subInsert.rows[0].id;

      payload = { userId, subscriptionId };
    } else {
      throw new Error(`Unknown scenario: ${scenario}`);
    }

    await client.query("COMMIT");

    // Mock auth token: a deterministic, run-scoped opaque string. A real
    // implementation would mint a short-lived JWT or session here.
    const authToken = `autonoma-test-token:${runId}:${userId}`;

    return res.json({
      runId,
      scenario,
      entities: payload,
      authToken,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Down
// ---------------------------------------------------------------------------

export async function handleDown(req, res) {
  const { runId } = req.body ?? {};

  if (!runId) {
    return res.status(400).json({ error: "`runId` is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Delete in reverse FK order: children before parents. This order is
    // specific to the example schema used in the blog post; adapt it to
    // match your own table relationships.
    await client.query("DELETE FROM cart_items   WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM carts        WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM subscriptions WHERE run_id = $1", [runId]);
    await client.query("DELETE FROM users        WHERE run_id = $1", [runId]);

    await client.query("COMMIT");

    return res.json({ runId, status: "torn-down" });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

export default { handleDiscover, handleUp, handleDown };
