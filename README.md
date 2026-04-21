# Database Isolation for Preview Environment Testing: The Full Spectrum

Companion code for the Autonoma blog post 'Database Isolation for Preview Environment Testing: The Full Spectrum'. Reference implementation of an Autonoma Environment Factory endpoint: HMAC-SHA256 request verification, discover/up/down lifecycle handlers, and run-scoped entity cleanup — ready to adapt to any Node.js/Express application.

> Companion code for the Autonoma blog post: **[Database Isolation for Preview Environment Testing: The Full Spectrum](https://getautonoma.com/blog/database-isolation-preview-environments)**

## Requirements

Node.js 18+, Express 4.x, pg 8.x for the Postgres handlers, Node's built-in crypto module for HMAC-SHA256.

## Quickstart

```bash
git clone https://github.com/Autonoma-Tools/database-isolation-preview-environments.git
cd database-isolation-preview-environments
Install dependencies with `npm install`, then set the `AUTONOMA_SHARED_SECRET` and `DATABASE_URL` environment variables and mount the router in your Express app at `POST /environment-factory`. See `src/environment-factory.js` for the dispatcher entry point, or run the bundled example with `npm start` (which launches `examples/example-app.js`).
```

## Project structure

```
.
├── LICENSE
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── src/
│   ├── environment-factory.js
│   ├── verify-signature.js
│   └── handlers.js
└── examples/
    └── example-app.js
```

- `src/` — primary source files for the snippets referenced in the blog post.
- `examples/` — runnable examples you can execute as-is.
- `docs/` — extended notes, diagrams, or supporting material (when present).

## About

This repository is maintained by [Autonoma](https://getautonoma.com) as reference material for the linked blog post. Autonoma builds autonomous AI agents that plan, execute, and maintain end-to-end tests directly from your codebase.

If something here is wrong, out of date, or unclear, please [open an issue](https://github.com/Autonoma-Tools/database-isolation-preview-environments/issues/new).

## License

Released under the [MIT License](./LICENSE) © 2026 Autonoma Labs.
