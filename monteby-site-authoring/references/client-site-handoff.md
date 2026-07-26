# Client Site Handoff

Use this reference when taking over, documenting, or handing off a complete WordPress installation built with Monteby. Keep this reference universal: never store client names, private assets, credentials, production hosts, fixed local paths, or project-specific ports here.

## Discover Before Documenting

Inspect the real project instead of reconstructing it from chat history:

1. Locate the project root and every applicable `AGENTS.md` or `CLAUDE.md`.
2. Inspect Compose files, `.env.example`, Dockerfiles, PHP configuration, README files, deployment notes, and ignore rules.
3. List only environment variable names needed to understand the topology. Do not print secret values from `.env`, `wp-config.php`, secret stores, SQL dumps, package archives, browser storage, or CI.
4. Resolve bind mounts to their real host paths and identify which mounted directories are independent Git repositories.
5. Run the project's actual Compose discovery and status commands, including the equivalent of `docker compose config --services` and `docker compose ps`, then verify container names, health, images, published ports, volumes, and profiles. Do not infer running state from YAML alone.
6. Use read-only WP-CLI to discover the WordPress URL, front page, active theme and parent theme, active plugins, published pages, global templates, menu locations, and relevant options.
7. Label discovered IDs, branches, versions, and statuses as a dated snapshot. The next agent must re-check live state before editing.

Do not modify the site while producing the inventory. Starting a stopped local stack is allowed only when the user asked to prepare a working environment and the Compose lifecycle is understood.

## Create Tool-Equivalent Instructions

Store the complete project contract in a root `AGENTS.md` for Codex. Provide a root `CLAUDE.md` for Claude Code with equivalent instructions, keeping `AGENTS.md` and `CLAUDE.md` semantically equivalent through one canonical body. Prefer one canonical body:

```markdown
# Project Instructions

@AGENTS.md
```

Claude Code can import `AGENTS.md` from `CLAUDE.md`, preventing duplicated rules from drifting. If the active Claude Code version cannot resolve imports, generate identical content from one source and add a validation check that compares both files.

Also provide a short copy-ready session prompt that tells the worker to:

- open the project root;
- read the tool-native instruction file and project documentation;
- inspect Compose and all related Git repositories before changing anything;
- load `monteby-site-authoring` for layout work and `monteby-widget-development` for product work;
- verify the local WordPress and visual reference URLs;
- fetch the live Monteby contract and current layout;
- keep secrets out of chat, files, logs, and commits;
- state the discovered environment status and then complete the assigned task with tests.

The prompt complements the project instructions; it must not duplicate the full contract.

## Map Sources Of Truth

Document each project area and its ownership. A typical complete site separates:

- WordPress database: canonical saved Monteby JSON, menus, pages, media metadata, global template selection, and SEO configuration;
- Monteby Builder repository: WordPress REST, editor, controls, media integration, host choices, persistence, and generated plugin assets;
- Monteby Core repository: canonical shared schemas, validation, migration, compiler, and renderer contracts;
- Monteby Theme repository: neutral shell, global template integration, and WordPress theme compatibility;
- project child theme: client-specific font enqueue, templates, branding assets, and narrowly site-specific presentation;
- project plugin: site-specific redirects, entities, explicit index policy, and behavior that does not belong in the universal product;
- media/source assets: licensed or user-provided originals and optimized derivatives;
- mockups/reference HTML: visual evidence only, never markup to import;
- authoring evidence: layout snapshots, validation payloads, preview output, and screenshots that may become stale or contain historical cookies, nonces, and request headers;
- deployment directory or package: immutable release snapshot, not the routine development source;
- database dumps and migration output: sensitive operational artifacts that never enter a public webroot or source repository.

If a project directory is not a Git repository, say so explicitly. Never claim its changes were committed.

Do not assume an existing ignore file protects operational artifacts. Before initializing Git or staging a project tree, audit ignore rules against `.env`, `wp-config.php`, SQL dumps, deployment archives, authoring readbacks, cookies, nonces, headers, logs, and browser-session output.

## Document The Docker Lifecycle

Record the exact project-specific commands for:

- starting the stack;
- showing service health and published ports;
- reading bounded application logs;
- running WP-CLI through the declared tools profile or service;
- stopping containers without deleting data.

Explain the difference between named volumes and bind mounts. State which source edits are immediately visible in WordPress and which artifacts require a build.

Treat destructive lifecycle commands as prohibited by default. Never run or recommend `docker compose down -v`, volume removal, database-directory deletion, or WordPress reinstallation without explicit approval and a verified backup.

Do not blindly normalize Docker invocation. Preserve a required Docker context, `DOCKER_HOST` handling, Compose project name, profile, or wrapper script discovered in the project.

## Record A Safe WordPress Snapshot

Use read-only WP-CLI or authenticated administrative APIs to record:

- home and site URLs;
- front page ID and reading mode;
- active child and parent themes;
- active plugin file names;
- published page IDs, titles, slugs, and statuses;
- global Monteby header/footer template IDs and types;
- WordPress menu locations and selected menu IDs.

Do not record administrator passwords, application passwords, cookies, nonces, access tokens, database credentials, or S3 keys. Point workers to the approved local secret source without exposing values.

Treat historical authoring directories as untrusted until audited and redacted. Never copy old cookie files, nonce captures, authorization headers, or raw browser-session output into a new handoff merely because they already exist locally.

## Preserve The Monteby Authoring Contract

The handoff must retain the normal site-authoring workflow:

1. Fetch the live site contract.
2. Fetch and snapshot the current versioned layout.
3. Author only contract-listed widgets, controls, `aiProps`, `allowedParents`, and host choices.
4. Validate through the official endpoint.
5. Save with the current modification precondition.
6. Preview through WordPress/PHP.
7. Reopen the editor and compare editor/frontend at desktop, tablet, and mobile widths.

Keep global header, page content, and global footer as separate resources. Use a real WordPress menu selected from host choices. Do not authorize `className`, raw HTML, raw CSS, direct post-meta writes, database edits, or HTML-to-node conversion in the handoff.

## Route Changes To Their Owner

Document the ownership decision:

- authoring mistake -> project layout JSON or authoring instructions;
- WordPress integration/editor UX -> Builder;
- shared schema/compiler/renderer/validation -> Core;
- proven shell or global-template integration defect -> Theme;
- client-only behavior -> child theme or project plugin;
- release artifact mismatch -> build/deployment pipeline.

Do not use the child theme as a hidden patch layer for missing universal controls. If a visual requirement cannot be expressed through the live contract, name the exact missing control and move the generic fix to Builder/Core with tests.

## Git And Deployment Boundaries

Run `git status --short --branch`, inspect upstreams, and record dirty or diverged repositories before work. Related repositories remain separate; do not combine them into one commit or overwrite unrelated changes.

The handoff must distinguish development sources from deployment artifacts. Do not edit an exported WordPress tree or release zip as routine source. Rebuild it in an explicit release step after tests, backup, environment-aware URL handling, and user approval.

Production database access, search-replace, import/export, plugin updates, S3 publication, DNS changes, and FTP upload are important actions. Perform them only under an explicit deployment task.

## Handoff Report

End a takeover or handoff with one bounded report containing:

- the active scope and current phase;
- every related repository's origin, branch, commit SHA, upstream relation, and dirty state;
- bind mounts from host sources to container paths;
- exact start, stop, build, test, and WP-CLI commands;
- active WordPress theme, parent theme, plugins, pages, menus, and global templates;
- the live contract version or fingerprint, without replacing a fresh contract fetch;
- site-specific child-theme and project-plugin ownership;
- secret variable names and approved sources, never values;
- deployment artifact location, backup status, rollback procedure, and actions that still need approval;
- editor/frontend evidence and known gaps;
- changed files, commits, CI results, and the next safe action.

## Acceptance Evidence

Before declaring the handoff usable, verify:

- Compose services are healthy and local URLs respond;
- the WP-CLI command documented for the project works;
- the WordPress inventory can be rediscovered without revealing secrets;
- project instructions identify every source-of-truth boundary;
- `CLAUDE.md` resolves to the same contract as `AGENTS.md`;
- the copy-ready prompt points to the correct files but does not duplicate them;
- automated project tests pass;
- editor and frontend smoke tests cover desktop, tablet, and mobile;
- no console errors, failed plugin assets, horizontal overflow, or hidden CSS-only authoring dependencies remain;
- the final report lists changed files, repository branches/commits, test commands, and unresolved risks.
