# Commit Convention

Use this file as the project reference before creating any commit.

## Base format
```text
type(scope): short and clear summary
- short note about what changed
- short note about impact, rule, or technical detail
- extra note only if it adds real context
```

## Rules
- Keep the summary short and specific
- Use bullet notes to explain the real change, not a vague summary
- Pick a scope that matches the impacted area
- Do not end the notes with a period
- Keep the notes as one continuous block, without blank lines between them
- When writing the commit message from the terminal, use one message block or a message file; multiple `-m` flags can split the bullets into separate paragraphs
- Avoid mixing unrelated changes in the same commit

## Recommended scopes
- `ui`
- `catalog`
- `cart`
- `order`
- `orders`
- `admin`
- `auth`
- `supabase`
- `api`
- `n8n`
- `scripts`
- `docs`
- `test`
- `chore`
- `refactor`
- `fix`

## Examples
```text
feat(catalog): improve product browsing
- Keep the filters panel aligned with the current desktop layout
- Make product cards easier to scan in the public storefront
- Preserve the current Clinic+ visual language
```

```text
fix(cart): keep notes and quantity stable
- Avoid losing notes when the quantity changes
- Keep the subtotal aligned with the product price helper
- Reduce duplicated cart calculations in page components
```

```text
docs(frontend): record the current Clinic+ visual pattern
- Describe the visual rules used by the public catalog
- Document reusable blocks and interaction patterns
- Remove dependence on older frontend transition notes
```

```text
chore(repo): add the project documentation base
- Create the local docs index and project context files
- Mirror the real repository structure in the organization notes
- Keep planning docs tied to the current codebase
```

## Current-state guidance
For the current working tree, it is better to split commits than to force everything into one.

Suggested split:

```text
refactor(components): reorganize shared and domain components
- Move catalog, cart, order and shared components into domain folders
- Remove the old root-level component copies
- Keep the UI structure aligned with the current page composition
```

```text
fix(core): harden product and order normalization
- Remove unsafe casts in product and order helpers
- Make Supabase row normalization more resilient
- Keep the TypeScript errors out of the data layer
```

```text
chore(tooling): standardize the project on npm
- Remove Bun lockfiles from the repository
- Keep package-lock.json as the single package manager lockfile
- Update tailwind and helper tooling to match the current stack
```

```text
docs(repo): align local documentation and commit guidance
- Mark documentation as local-only in the repository setup
- Record the future structure ideas in one place
- Keep the commit examples in English with Conventional Commits
```

## How to decide whether to split
- If a change can be rolled back independently, it should usually be a separate commit
- If a change touches structure and behavior, split it
- If a change is only docs or tooling, keep it separate from runtime code
- If a commit starts needing a long explanation, it is usually too broad

## Practical rule for this repo right now
The current state is broad enough that I would not keep it in one commit.

Minimum recommended separation:
- one commit for component/structure moves
- one commit for bug fixes and type-safety cleanup
- one commit for tooling and root cleanup
- one commit for docs and conventions

## Reminder
Keep commit messages close to the actual code state.
If a change touches more than one area, the scope and notes must make that clear.
