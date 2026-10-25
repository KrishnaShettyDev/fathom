# Repository foundation

Status: scaffold implemented; local runtime verification is blocked by sandbox permissions.

## Outcome and scope

Give contributors one repeatable development workflow before implementing tenancy
or connectors. Implements the PRD Part 5, days 1–2 repository prerequisite.
Includes shared instructions, runtime layout, quality commands, and a CI workflow. Excludes deployed infrastructure, identity, tenant
authorization, database migrations, and product screens.

## Inspection and decisions

The workspace initially contained only the PRD. There was no Git repository,
application code, package manifest, or existing convention to preserve. See ADR
0001 for the PRD-mandated architecture. Add only the web/worker runtimes now;
shared packages follow when they contain actual domain code.

## Acceptance and failure cases

- Agent entrypoints point to one maintained set of engineering standards.
- A contributor can identify implemented versus planned functionality.
- Installed dependencies have exact versions and a committed lockfile.
- Web health and worker lifecycle can be exercised without customer credentials.
- Check commands fail on formatting, lint, typing, test, or build failures.
- No unauthenticated endpoint exposes customer data or pretends to be a connector.

## Ordered implementation

1. Write shared instructions, the phase plan, and architecture decision.
2. Resolve compatible dependencies and create the web/worker workspace.
3. Add formatting, lint, types, lifecycle checks, build commands, and CI.
4. Exercise the runtimes, inspect files, and record evidence and blockers.

## Verification and rollout

Provisioning Railway and Supabase is pending account access and region decisions.
No cloud resources are created by this feature. Runtime checks must be recorded
below. The CI workflow has not run on GitHub yet.

### Local evidence (2026-10-25)

- Dependencies installed with exact direct versions and `package-lock.json`.
  npm reported zero known vulnerabilities at installation time.
- Formatting, ESLint, and web/worker type checks passed using Node 24.22.1.
- Port-validation behavior passed. The two HTTP/lifecycle tests failed to start
  listeners because this sandbox denies localhost binding (`listen EPERM`).
  They remain required; the aggregate `npm run check` is not green here.
- Production web and worker builds passed on Node 24.22.1 and host Node 26.4.0.
- README links and JSON syntax checked. Source files reviewed; no customer
  data or credentials were added. The supplied HTML PRD was not edited.
- Git initialization was denied by filesystem policy (`.git: Operation not
permitted`). No commit, remote, push, or hosted CI run has occurred.

### Remaining before milestone closure

Run the full checks in an environment permitting local listeners; verify the
web health route at runtime; initialize Git when filesystem policy permits;
provision and deploy the empty runtimes after account/region decisions.
