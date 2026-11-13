# Bomberman-2.0-Backend

Server of a multiplayer Bomberman game. The server is authoritative for game state.

Stack: Node.js, Express, socket.io, MongoDB (Mongoose), TypeScript, Biome.

## npm scripts

| Script | Action |
| --- | --- |
| `npm run dev` | nodemon with ts-node |
| `npm run build` | `tsc`, then copy `src/maps` to `dist` |
| `npm run start` | Run `dist/app.js` |
| `npm run lint:fix` / `npm run format:fix` | Biome lint / format with fixes |
| `npm run format` | Biome format check |

`_moduleAliases` in `package.json` point at `./dist`. Run `npm run build` after you change an aliased module.

## Checks before a commit

1. Biome: `npx biome lint .` and `npx biome format .`
2. Types: `npx tsc --noEmit`
3. Build: `npm run build`

## Workflow

- Open PRs to `dev`.
- Use Conventional Commits. Do not add AI attribution. See `.claude/rules/`.

## Workspace

Architecture docs, shared rules, skills and agents live in the workspace repo `NickDurnev/Bomberman-2.0-Workspace`. When this repo is checked out as its submodule, read `../CLAUDE.md` and `../docs/README.md` first. In a standalone clone, the docs are at https://github.com/NickDurnev/Bomberman-2.0-Workspace.

`.claude/skills/pr-review` and `.claude/agents/game-contract-reviewer.md` are copies of the workspace versions for cloud routines; edit them in the workspace repo first, then copy.
