You are building a production-ready software product named "DoIHaveMoney", a deliberately focused alternative to YNAB. Build a complete, usable vertical slice—not a landing page, static mockup, or disconnected collection of components.


# WORKING AGREEMENT
Before writing implementation code, produce a short technical plan that names the routes or pages, server actions or endpoints, data tables, important state transitions, authorization boundaries, background jobs, and external adapters. Resolve contradictions in favor of the narrow audience and non-goals below. Prefer a small, legible architecture over speculative abstraction, but do not omit persistence, validation, error handling, or tests.

# DELIVERABLES
Ship the working application, migrations, representative seed data, tests, .env.example, and a concise README. The README must cover prerequisites, local setup, environment variables, migrations, seed and test commands, deployment, integration setup, backup and restore, security decisions, and known limitations. Seed data should exercise the happy path plus at least one empty, failed, overdue, expired, archived, or permission-restricted state relevant to the product.

# DEFINITION OF DONE
The app is complete when a fresh developer can follow the README, create and migrate the database, run the app, sign in as each relevant role, complete every named journey using real persisted data, refresh without losing state, recover from common failures, and use the core interface on phone and desktop. All acceptance scenarios pass, permission boundaries are covered by tests, and no core screen is left as a placeholder.

# Technology Directions
## Overall
- Do not create any external services. If you need anything, ask for human input. At bare minimum, I will provide `DATABASE_URL`, `JWT_SECRET` in .env file
- IMPORTANT! : Any change in table design will require human approval before proceeding. Before asking for human's approval, export table schema to `./TableDesign/<version>` in dbdiagram code.

## Tech Stack
# Development Guidelines

### 1. Full-Stack Architecture

- **Language:** TypeScript across the full stack.
- **Framework:** Next.js with the App Router.
- **ORM:** Drizzle ORM.
- **CSS:** Use TailwindCSS with DaisyUI
- **API design:** Follow RESTful conventions for endpoints, HTTP methods, status codes, and resource naming.
- **Routing:** Use the Next.js App Router conventions for pages, layouts, dynamic routes, and route handlers.
- **Data lookup:** Use `slug` instead of `id` for resource lookup in application-facing queries and routes, unless an operation specifically requires an internal ID.
- **Response format:** All API endpoints must return a consistent response structure:

  ```typescript
  type ApiResponse<T> = {
    status: number;
    message: string;
    data: T | null;
  };
  ```

Server Actions and API Calls

- **Prioritize Server Actions** for operations initiated by the application UI, especially authenticated mutations.
- Prefer Server Components for server-side data fetching and rendering.
- Use Route Handlers for public APIs, external integrations, webhooks, and endpoints that need to be consumed outside the Next.js application.
- Before making an API call from a Client Component, determine whether the operation can be handled securely and more directly through a Server Action or Server Component.
- Use client-side API calls only when necessary, such as for interactive client-side behavior, browser-only operations, or APIs that must be accessed directly by the client.
- Do not expose secrets, private credentials, or server-only logic to Client Components.

### 2. Authentication and Authorization

- Use JWT-based authentication with two tokens:
  - `accessToken`: Used to authenticate requests to protected resources.
  - `refreshToken`: Used to obtain a new access token when the current one expires.
- Centralize token validation, refresh logic, and authentication checks where practical.
- Enforce authorization on the server for every protected operation. Never rely solely on client-side route guards or UI visibility.
- Store tokens using an appropriate secure strategy. Prefer `HttpOnly`, `Secure`, and appropriate `SameSite` cookies for browser-based authentication when applicable.
- Never expose refresh tokens or sensitive authentication credentials in client-side JavaScript, URLs, or logs.
- Handle expired tokens, invalid tokens, and unauthorized requests consistently.

### 3. Database and ORM

- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM with schema definitions and version-controlled migrations.
- Define database schemas and relationships explicitly, using appropriate data types, constraints, indexes, and foreign keys.
- Every core entity table must include, at minimum:
  - `id`: Primary key.
  - `createdAt`: Creation timestamp.
  - `updatedAt`: Last modification timestamp.
- Use consistent naming conventions for tables, columns, relations, and indexes.
- Use database constraints to enforce data integrity where appropriate.
- Generate and apply migrations for schema changes. Do not rely on manually modifying the database schema without updating migrations.
- Create mapping or junction tables only when required to represent relationships, such as many-to-many relationships. Avoid unnecessary tables and redundant relationships.
- Use transactions when multiple database operations must succeed or fail together.
- Use `slug` for application-facing resource lookups where appropriate, while retaining `id` for primary keys, foreign keys, and internal relational integrity.

### 4. Caching and Data Fetching

- There is currently no dedicated caching database, such as Redis.
- Use Next.js caching capabilities for eligible server-side data fetching and API responses.
- Choose an appropriate caching strategy based on the data's freshness requirements:
  - Use cached data for relatively stable resources.
  - Use revalidation or tags when cached data must be refreshed after mutations.
  - Use uncached or explicitly dynamic fetching for sensitive, user-specific, or rapidly changing data.
- Invalidate or revalidate relevant cached data after successful mutations to prevent stale results.
- Never cache authentication tokens, sensitive user data, or personalized responses in a way that could expose one user's data to another.
- Do not introduce Redis or another caching database unless explicitly requested.

### 5. Implementation Principles

- Follow existing project conventions before introducing new patterns or dependencies.
- Prefer simple, maintainable, type-safe solutions over unnecessary abstractions.
- Reuse existing services, utilities, and shared types where appropriate.
- Validate and normalize external input on the server.
- Use consistent error handling across Server Actions and Route Handlers.
- Keep business logic separate from UI components and avoid duplicating logic across server and client code.
- Before implementing a feature, identify the appropriate execution boundary: Server Component, Server Action, Route Handler, or Client Component.
- Do not introduce unnecessary mapping tables, API endpoints, client-side fetching, or infrastructure.
- Ensure new code follows the established architecture and remains consistent with these guidelines.


# NON-GOALS
Do not connect directly to banks, move money, recommend investments, calculate taxes, or support multiple currencies in one budget.