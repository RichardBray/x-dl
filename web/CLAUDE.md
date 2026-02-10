# x-dl Web

Web UI for x-dl — a tool that downloads tweets/posts from X (Twitter) and generates articles from them using AI transcription. Users can input a tweet URL, download its content, and view a generated article.

## Tech Stack

- **Runtime/Package Manager:** Bun
- **Framework:** React 19 with TypeScript
- **Routing:** React Router v7
- **Build Tool:** Vite 7
- **Linting:** ESLint with TypeScript and React plugins

## Coding Preferences

### General

- Use TypeScript for all code
- Use Bun as the package manager (never npm/npx — always use `bun`/`bunx`)
- Use function declarations, not function expressions
- Function names must start with a verb and be more than one word (e.g. `formatError` not `error`, `handleSubmit` not `submit`)
- Prefer object lookups over chained `if`/`else if` statements; use `switch` only if object lookup doesn't fit
- Variable names must be descriptive — avoid abbreviations or single-context-free words (e.g. `lowercaseMessage` not `lower`, `userEmail` not `email` in ambiguous contexts)

```typescript
// Good
function handleRequest() {}

// Bad
const handleRequest = () => {}
```

### Project Structure

- Use a `services/` folder for business logic
- Services should be implemented as classes
- Keep route handlers thin - delegate to services

```
api/
├── src/
│   ├── index.ts           # Main Hono app with routes
│   ├── middleware/        # Auth and other middleware
│   ├── services/          # Business logic classes
│   ├── db/                # Database schema and migrations
│   └── types.ts           # TypeScript types
```

### Routes

- Add a one-line comment above each endpoint explaining its purpose
- Example:
```typescript
// Records a new tap (resist or yield) for the authenticated user
app.post('/api/taps', async (c) => { ... })
```

### Services

- Use classes for services
- Constructor should accept dependencies (like DB connection)
- Methods should use function declaration syntax within the class

```typescript
class TapService {
  constructor(private db: D1Database) {}

  async createTap(userId: string, data: TapInput): Promise<Tap> {
    // implementation
  }
}
```

### Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages
- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`, `ci`, `perf`
- Scopes: `mobile`, `api`, `web`, or omit for cross-cutting changes
- Examples:
  - `feat(mobile): add inline auth error validation`
  - `fix(api): handle missing session token on sign-out`
  - `refactor: extract shared theme constants`
  - `chore: update Expo SDK dependencies`

### Testing

- Use wrangler for local development and testing
- Test API endpoints with curl during development
- Use `agent-browser` for browser testing (available globally):
  - `agent-browser open <url>` — navigate to a URL
  - `agent-browser snapshot` — get accessibility tree with refs
  - `agent-browser fill '<selector>' '<value>'` — fill input fields
  - `agent-browser click '<selector>'` — click elements
  - `agent-browser screenshot <path>` — capture screenshots
  - `agent-browser eval '<js>'` — run JavaScript in the page
  - `agent-browser close` — close the browser
- When testing web UI changes, use agent-browser to verify the flow end-to-end

For detailed repeatable patterns and workflows, see [CODE_GUIDELINES.md](./CODE_GUIDELINES.md).

### Git Workflow

- After completing changes, automatically commit and push to the current branch
- Never commit or push directly to `main` without asking the user first — always work on a feature branch

### Pre-Commit Quality Hook

A Claude Code hook runs `oxlint`, `jscpd`, and `knip` on staged `.ts`/`.tsx` files before each commit. When the hook fails:

1. Present the list of issues to the user
2. Ask the user which issues to fix before proceeding (don't auto-fix all)
3. Fix only the approved issues, re-stage, and retry the commit
