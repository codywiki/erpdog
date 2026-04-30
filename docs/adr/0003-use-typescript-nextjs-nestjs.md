# ADR-0003: Use TypeScript, Next.js, and NestJS

## Status

Proposed

## Context

erpdog needs a responsive web UI, a maintainable business API, background jobs, Excel import/export, file upload, and future Feishu integration. Code readability and long-term maintainability are explicit goals.

The product will be operated mostly on desktop browsers, with mobile support for critical actions. The backend must keep business rules centralized rather than duplicating logic in the browser.

## Decision

Use TypeScript across the main application:

- Next.js + React for the web app.
- NestJS for the API.
- A separate TypeScript worker process for background jobs.
- Shared packages for config, API contracts, enums, and generated types.

Use REST APIs with OpenAPI documentation for Phase 1. Avoid GraphQL unless a later use case clearly needs it.

## Consequences

### Positive

- One language across web, API, and worker.
- Strong typing reduces integration mistakes.
- Next.js is a good fit for responsive web applications.
- NestJS gives explicit modules, dependency injection, guards, pipes, and testable services.
- REST is familiar, easy to debug, and compatible with Feishu callbacks and future mobile clients.

### Negative

- TypeScript monorepo requires good tooling discipline.
- NestJS decorators and DTOs can become verbose if not kept clean.
- Heavy frontend tables require careful performance work.

### Neutral

- If the team later prefers Python for data/reporting jobs, separate reporting workers can be added without changing core architecture.

## Alternatives Considered

**Django + React**

Strong alternative. Django is excellent for admin-heavy internal tools, but using TypeScript end-to-end gives tighter frontend/backend contract consistency for this project.

**Next.js full-stack only**

Rejected for Phase 1 because core financial workflows, approvals, jobs, and integrations benefit from a dedicated backend boundary.

**Java/Spring Boot**

Technically strong, but heavier for the expected project scale and slower to iterate for this internal product.

## References

- https://nextjs.org/docs/app
- https://docs.nestjs.com/modules
