# ADR 0001: Modular monolith with separate worker runtime

Status: accepted from PRD; runtime compilation verified; lifecycle validation remains pending.

Use Next.js App Router for web/HTTP, a persistent Node worker, Supabase Postgres,
Auth and Storage, Railway deployment, SQL migrations, and pg-boss when durable
jobs are introduced. One TypeScript workspace shares domain rules and contracts.

A single-process application cannot safely host long jobs in request lifetimes.
Independent microservices add deployment and consistency costs without evidence
of need. Two runtimes keep the codebase cohesive while separating workloads.
Do not add Redis, a vector database, another ORM, or an OAuth broker speculatively.

Use Node 24 LTS and npm workspaces initially. Exact direct dependency versions
and the lockfile make installs reproducible. Revisit the workspace runner only
when measured build complexity requires it; changing package manager is cheap
now and increasingly expensive after CI and deployment scripts depend on it.

Official compatibility references (checked 2026-10-25):

- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://github.com/nodejs/Release/blob/main/README.md

Database region and deployment accounts remain owner decisions. This ADR does
not imply infrastructure has been provisioned or security controls implemented.

Toolchain note: ESLint 9.39.5 and TypeScript 6.0.3 match the installed Next.js
lint dependency peer ranges. The registry marks ESLint 9 deprecated. Do not
force incompatible ESLint 10 peers; revisit the lint toolchain before production
and upgrade when the import plugin and Next.js configuration support it.
