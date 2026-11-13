# Bomberman-2.0-Backend

Server of a multiplayer Bomberman game. The server is authoritative for game state.

Stack: Node.js, Express, socket.io, MongoDB (Mongoose), TypeScript, Biome.

## npm scripts

| Script | Action |
| --- | --- |
| `npm run dev` | nodemon with ts-node |
| `npm run build` | `tsc`, then copy `src/maps` to `dist` |
| `npm run start` | Run `dist/app.js` |
| `npm run lint:fix` / `npm run format:fix` | Biome lint / format with fixes on the whole repo. Do not use them before a commit (see below) |
| `npm run format` | Biome format check |

`_moduleAliases` in `package.json` point at `./dist`, so aliased imports (`@entity`, `@constants`, ...) load from `dist`, even under `npm run dev`. Run `npm run build` after any change in `src/`. In the workspace, `make backend` rebuilds `dist` and restarts on every `src/` change.

## Checks before a commit

Never commit with a NEW failure. `<changed files>` means only the files you changed yourself.

1. Biome: `npx biome check --write <changed files>`. Never run Biome with `--write` on the whole repo: it rewrites many unrelated files.
2. Types: `npx tsc --noEmit`. Compare the errors with the same command on `origin/dev`.
3. Build: `npm run build`

`dev` currently has existing Biome errors (no known `tsc` errors). Your change must add no NEW errors versus `origin/dev`. Do not fix unrelated errors in the same PR.

There is no test script.

## Workflow

- Open PRs to `dev`.
- Use Conventional Commits. Do not add AI attribution. See `.claude/rules/`.

## Workspace

Architecture docs, shared rules, skills and agents live in the workspace repo `NickDurnev/Bomberman-2.0-Workspace`. When this repo is checked out as its submodule, read `../CLAUDE.md` and `../docs/README.md` first. In a standalone clone, the docs are at https://github.com/NickDurnev/Bomberman-2.0-Workspace.

`.claude/skills/pr-review` and `.claude/agents/game-contract-reviewer.md` are copies of the workspace versions for cloud routines; edit them in the workspace repo first, then copy.
