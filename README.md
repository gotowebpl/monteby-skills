# Monteby Skills

Reusable Agent Skills for working with the Monteby ecosystem.

This repository contains two skills:

- `monteby-site-authoring` - author or modify layouts on any live WordPress site running Monteby Builder + Monteby Theme by fetching the site's live REST contract, validating Monteby JSON, saving through the official API, and previewing through WordPress/PHP.
- `monteby-widget-development` - develop Monteby Builder/Core/Theme widgets in local repositories, including props-first schema controls, AI props, renderer parity, validation, and tests.

## Requirements

- Git.
- Codex or Claude Code installed.
- A local clone of this repository:

```bash
git clone git@github.com:gotowebpl/monteby-skills.git
cd monteby-skills
```

HTTPS clone also works:

```bash
git clone https://github.com/gotowebpl/monteby-skills.git
cd monteby-skills
```

## Install For Codex

Codex skills are folders containing a required `SKILL.md` file and optional `references/`, `scripts/`, `assets/`, and `agents/` resources.

Current Codex documentation describes global skills under `$HOME/.agents/skills` and project skills under `.agents/skills`. Some local Codex setups also load `$HOME/.codex/skills`. Use the first path by default; use the second only if your Codex installation is configured that way.

### Global User Install

```bash
mkdir -p "$HOME/.agents/skills"
rsync -a --delete ./monteby-site-authoring "$HOME/.agents/skills/"
rsync -a --delete ./monteby-widget-development "$HOME/.agents/skills/"
```

Optional compatibility install for Codex setups that use `~/.codex/skills`:

```bash
mkdir -p "$HOME/.codex/skills"
rsync -a --delete ./monteby-site-authoring "$HOME/.codex/skills/"
rsync -a --delete ./monteby-widget-development "$HOME/.codex/skills/"
```

### Project Install

From the target project repository:

```bash
mkdir -p .agents/skills
rsync -a --delete /path/to/monteby-skills/monteby-site-authoring .agents/skills/
rsync -a --delete /path/to/monteby-skills/monteby-widget-development .agents/skills/
```

### Use In Codex

Restart Codex if the skills do not appear automatically.

Invoke explicitly by mentioning the skill:

```text
$monteby-site-authoring
```

```text
$monteby-widget-development
```

Codex can also invoke skills implicitly when the task matches the skill description.

## Install For Claude Code

Claude Code loads skills from user-level `~/.claude/skills/` and project-level `.claude/skills/`.

### Global User Install

```bash
mkdir -p "$HOME/.claude/skills"
rsync -a --delete ./monteby-site-authoring "$HOME/.claude/skills/"
rsync -a --delete ./monteby-widget-development "$HOME/.claude/skills/"
```

### Project Install

From the target project repository:

```bash
mkdir -p .claude/skills
rsync -a --delete /path/to/monteby-skills/monteby-site-authoring .claude/skills/
rsync -a --delete /path/to/monteby-skills/monteby-widget-development .claude/skills/
```

### Use In Claude Code

Start Claude Code in the target project and invoke a skill directly:

```text
/monteby-site-authoring
```

```text
/monteby-widget-development
```

Claude Code may also use skills automatically when relevant.

## Updating Installed Skills

Pull the repository:

```bash
cd /path/to/monteby-skills
git pull
```

Then rerun the install command for your agent. The `--delete` flag keeps the installed copy identical to this repository.

## Which Skill To Use

Use `monteby-site-authoring` when the agent is working against a real WordPress site:

- fetch `/wp-json/monteby/v1/contract`
- build Monteby JSON only from the live contract
- validate through `/validate`
- save through `/pages/{id}/layout`
- preview through `/preview`
- use child-theme custom widgets only when the live contract exposes them

Use `monteby-widget-development` when the agent is changing product source code:

- add or modify a widget/block
- convert a widget to props-first controls
- update `aiProps`, `allowedParents`, defaults, schemas, manifests, or renderers
- work across `monteby-builder`, `monteby-core`, or `wp-monteby-theme`
- add PHPUnit/Vitest/PHPStan/type-check coverage

## Validation

Each skill must contain a valid `SKILL.md` frontmatter block with `name` and `description`.

When using Codex's built-in skill creator tooling, validate a skill with:

```bash
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" ./monteby-site-authoring
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" ./monteby-widget-development
```

If your Codex installation stores system skills elsewhere, adjust the path to `quick_validate.py`.

## Official References

- OpenAI Codex Agent Skills: https://developers.openai.com/codex/skills
- OpenAI Codex customization paths: https://developers.openai.com/codex/concepts/customization
- Claude Code skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code settings and skill paths: https://docs.anthropic.com/en/docs/claude-code/settings
