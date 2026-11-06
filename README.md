# pargoo agent-lab

Plugins and standalone skills for AI coding agents, maintained by **pargoo**.

## Plugins

### pargoo Strapi (Apple Silicon)

Manage Strapi content through your agent, with a panel for projects, environments and publication approvals. Requires macOS 13+ on Apple Silicon.

**Installation prompt**

> Install pargoo Strapi from https://github.com/pargoo-GmbH/agent-lab. Follow the plugin's README to connect the marketplace, install the Apple Silicon package and verify that it starts.

[Plugin documentation](plugins/strapi-editor/README.md)

### pargoo DevFlow

A plugin for AI-assisted software development, from a task description or GitHub Issue to Pull Request.

**Included skills:**

- `develop`
- `grilling`
- `refine-issue-plan`
- `split-issue-into-subissues`
- `report-implementation`
- `review-implementation`
- `creating-pull-requests`

#### Install Plugin (Codex)

```bash
codex plugin marketplace add pargoo-GmbH/agent-lab
codex plugin add pargoo-devflow@pargoo-agent-lab
```

Start a new Codex session and select a skill from the installed Plugin.

## Install Individual Skills

Install any skill independently using the [Skills CLI](https://github.com/vercel-labs/skills).

**List available skills:**

```bash
npx skills add pargoo-GmbH/agent-lab --list
```

**Install a standalone skill:**

```bash
npx skills add pargoo-GmbH/agent-lab --skill building-components
```

Available standalone skills:

- `building-components`
- `organizing-classnames`

**Install skills from the Plugin independently:**

```bash
npx skills add pargoo-GmbH/agent-lab/plugins/pargoo-devflow
```

Select the skills to install when prompted, or specify one with `--skill`:

```bash
npx skills add pargoo-GmbH/agent-lab/plugins/pargoo-devflow --skill develop
```

Replace `develop` with another Plugin skill name to install that skill.

Add `-g` to a Skills CLI installation command to install globally instead of into the current project.
