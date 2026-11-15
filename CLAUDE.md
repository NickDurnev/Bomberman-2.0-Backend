# Bomberman-2.0-Backend

Server of a multiplayer Bomberman game. The server is authoritative for game state.

Stack: Node.js, Express, socket.io, MongoDB (Mongoose), TypeScript, Biome.

## npm scripts

| Script | Action |
| --- | --- |
| `npm run build` | `tsc`, then copy `src/maps` to `dist` |
| `npm run start` | Run `dist/app.js` |
| `npm run check` | `biome ci .`: lint and format check on the whole repo, no writes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest run once / in watch mode |
| `npm run lint:fix` / `npm run format:fix` | Biome lint / format with fixes on the whole repo |
| `npm run format` | Biome format check |

`_moduleAliases` in `package.json` point at `./dist`, so aliased imports (`@entity`, `@constants`, ...) load from `dist`. Run `npm run build` after any change in `src/`. In the workspace, `make backend` rebuilds `dist` and restarts on every `src/` change.

## Checks before a commit

Never commit with a failing check. Each command must exit 0. `<changed files>` means only the files you changed yourself.

1. Fix Biome in your files: `npx biome check --write <changed files>`.
2. Lint and format: `npm run check`
3. Types: `npm run typecheck`
4. Tests: `npm test`
5. Build: `npm run build`

CI runs the same `checks` job on every PR to `dev`. A red check blocks the merge.

Tests: see `docs/testing.md` in the workspace.

## Workflow

- Open PRs to `dev`.
- Use Conventional Commits. Do not add AI attribution. See `.claude/rules/`.

## Workspace

Architecture docs, shared rules, skills and agents live in the workspace repo `NickDurnev/Bomberman-2.0-Workspace`. When this repo is checked out as its submodule, read `../CLAUDE.md` and `../docs/README.md` first. In a standalone clone, the docs are at https://github.com/NickDurnev/Bomberman-2.0-Workspace.

`.claude/skills/pr-review` and `.claude/agents/game-contract-reviewer.md` are copies of the workspace versions for cloud routines; edit them in the workspace repo first, then copy.
