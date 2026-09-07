<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Test-driven development

Every testable behaviour is built test-first: **red → green → refactor**. Write the failing test, run it, watch it fail for the right reason, then write the minimum code to pass. Use the `tdd` skill for feature and bug work; prefer integration tests over shallow unit tests.

In scope: DAL functions, Server Actions, status-machine transitions (order / listing / cancellation), the buyer provenance-match query and facet narrowing, de-dup / merge rules, the publish checklist, notification writes, the cancellation auto-approve sweep. Out of scope: the Prisma schema shape, config, one-line pass-throughs.

DAL and Server Action tests run against a real Postgres (a Neon test branch or Testcontainers), never a mock.
