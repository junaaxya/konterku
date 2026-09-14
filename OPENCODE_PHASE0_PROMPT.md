# OpenCode Initial Build Prompt

Use this prompt after placing `AGENTS.md`, `ARCHITECTURE.md`, `FLOW.md`, and `RULES.md` in the repository root.

---

You are the implementation agent for KONTERKU.

Before writing code, read in full:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `FLOW.md`
- `RULES.md`

Then inspect the existing repository.

Your first assignment is **Phase 0 — Foundation only**.

Build the minimum production-ready foundation for the local-first KONTERKU web app using the repository contracts.

Requirements for this phase:

1. Next.js with App Router and strict TypeScript.
2. pnpm.
3. Tailwind CSS.
4. shadcn/ui baseline setup if not already configured.
5. PostgreSQL.
6. Prisma.
7. Zod/environment validation.
8. Docker Compose for the application and PostgreSQL.
9. Persistent PostgreSQL volume.
10. Containers configured to restart automatically for normal local-server use.
11. The app must be capable of listening on the LAN rather than only localhost.
12. Add a minimal mobile-first application shell in Bahasa Indonesia.
13. Add a simple health endpoint.
14. Add a basic automated test setup appropriate for the stack.
15. Add `.env.example`.
16. Add/update README instructions for:
    - development startup,
    - Docker startup,
    - database migrations,
    - LAN access,
    - stopping/restarting the service.

Do NOT implement:

- transaction features,
- account management,
- ledger,
- reports,
- printing,
- authentication,
- Redis,
- separate backend service,
- external APIs,
- public deployment.

Implementation workflow:

1. Inspect.
2. Give a concise plan.
3. Implement Phase 0.
4. Run relevant lint/typecheck/test/build/Prisma checks that actually exist.
5. Fix problems found by verification.
6. Stop after Phase 0.

Do not begin Phase 1.

At completion provide:

Changed:
- files/features added

Verified:
- exact commands run and their result

Not done:
- explicitly state that Phase 1 Accounts + Ledger has not been started

If an existing repository decision conflicts with the docs, preserve working code where reasonable and report the conflict instead of silently rewriting the architecture.
