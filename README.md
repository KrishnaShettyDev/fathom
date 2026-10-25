# Marketing OS

A marketing workspace for commerce brands and agencies. The product is being
built from the supplied [PRD](Marketing_OS_Complete_PRD.html), starting with
Phase One: Intelligence.

## Start here

- [Agent instructions](AGENTS.md): required workflow and commit conventions.
- [Engineering standards](docs/engineering/standards.md): review criteria.
- [Phase One plan](docs/plans/phase-1.md): scope, sequence, and release gates.
- [Repository foundation](docs/plans/repository-foundation.md): runtime setup.
- [Intelligence frontend](docs/plans/frontend-intelligence.md): current UI scope.
- [Feature plan template](docs/plans/feature-template.md): plan before coding.
- [Architecture decision](docs/decisions/0001-architecture.md): runtime boundaries.

Codex reads `AGENTS.md`; Claude reads `CLAUDE.md`, which imports the shared rules.
Cursor loads the pointer in `.cursor/rules/project.mdc`. For another agent, load
`AGENTS.md` and the engineering standards into its project instructions.

## Current status

Fathom uses real Supabase email OTP authentication and persistent, owner-created
brand workspaces. Access is enforced by server session checks and database RLS.
There are no seeded brands, sample measurements, invented evidence, or mock exports.
The intelligence screens show unavailable states until connectors are implemented.

See [local development](docs/engineering/local-development.md) and the
[identity feature plan](docs/plans/identity-and-real-data.md) for setup and evidence.
Shopify connection, agency invitations, and source collection remain next milestones.

## Local development

Use Node 24.22.1 (`nvm use`) and npm 11.17.0.

```sh
npm ci
npm run db:start
npm run db:configure
npm run dev
# In another terminal:
npm run dev:worker
```

Web: http://localhost:3000. Local email codes: http://127.0.0.1:55434.
Worker: http://localhost:3001/healthz.
Web liveness: http://localhost:3000/api/health. These endpoints only prove that
the processes respond; they do not claim database or connector readiness.
The worker intentionally reports `queue: not_configured` until the durable job
milestone. It accepts `PORT` for deployment; the default is 3001.

```sh
npm run check  # format, lint, types, tests, and production builds
npm run format
```

After building, run each runtime separately:

```sh
npm start --workspace=@marketing-os/web
npm start --workspace=@marketing-os/worker
```

The CI workflow runs on GitHub after the project is placed in a repository and
pushed there. No remote, cloud service, database, or paid provider is provisioned.
Use the local instance for development. Production onboarding requires hosted
configuration, SMTP, abuse controls, and the remaining release gates.
