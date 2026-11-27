# Recovery checkpoint — 2026-11-28

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


## Verified safe checkpoint

- Repository: `KaranJoyKundu/Daredevil-s-Eye`
- Original main commit: `98c9864fabf068ca7a904f5b91d6ad8264561108`
- Backup branch: `backup/pre-documentation-overhaul-2026-11-28`
- Backup branch points to the exact original commit above.
- Working branch: `docs/product-map-and-ux-overhaul`
- Working branch was created from the verified backup branch.
- At checkpoint creation, `main` remained at the same SHA.

## Restore options

To restore a local checkout to the checkpoint without rewriting Git history:

```bash
git fetch origin
git switch main
git reset --hard 98c9864fabf068ca7a904f5b91d6ad8264561108
```

This reset is destructive to uncommitted local changes. Back them up first.

For a non-destructive recovery/inspection, create a new branch from the backup:

```bash
git fetch origin
git switch -c recovery/pre-documentation-overhaul origin/backup/pre-documentation-overhaul-2026-11-28
```

## Guardrails for this overhaul

- Never edit `main` directly.
- Keep work on `docs/product-map-and-ux-overhaul` until review and acceptance.
- No backend, Worker, API, camera, AI, SOS, RFID, Android, firmware, database, or authentication logic changes in this overhaul.
- UI changes are limited to the approved Documentation and Admin surfaces plus shared styles/navigation only when necessary.
- If an unexpected functional bug requires code changes, document it separately and stop before changing behavior.
- Do not merge without explicit user approval after the PR review.

## Tag limitation

The GitHub connector available during checkpoint creation can create a branch but does not expose a tag-creation operation. The backup branch is created and SHA-verified; an immutable Git tag remains a manual optional follow-up.
