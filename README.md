# Nemo Esuriat

Personal portfolio and blog site for William Chenevert — a hybrid platform featuring professional projects, blog articles, and an embedded interactive game engine.

**Live site:** [ChenevertSoftwareServices](https://ChenevertSoftwareServices.com)

## Overview

Nemo Esuriat is a single-page application built with a custom Knockout.js-based SPA framework on an ASP.NET Core backend. The site includes:

- **Portfolio** — Showcasing software projects and presentations
- **Blog** — Articles on career development, technical projects, recipes, and hobbies
- **Unknown** — A from-scratch game engine built in TypeScript featuring entity-component architecture, scene management, and turn-based gameplay
- **Heartbreaker** — A D&D character generator

## Tech Stack

| Layer     | Technology                                      |
|-----------|------------------------------------------------|
| Backend   | .NET 9.0 / ASP.NET Core (C#)                  |
| Frontend  | TypeScript, Knockout.js, ES6 modules           |
| Styling   | LESS                                            |
| Testing   | Vitest, happy-dom                               |
| Build     | MSBuild (tsc → build → copy to wwwroot)        |

## Project Structure

```
├── Client/                  Frontend source
│   ├── HTML/                Templates & blog content
│   │   ├── BlogViews/       Blog articles
│   │   ├── WebCoreViews/    SPA framework components
│   │   └── WebPlugins/      Project-specific views
│   ├── Scripts/             TypeScript source
│   │   ├── WebCore/         SPA framework (routing, bindings, entry)
│   │   ├── WebPlugins/      Blog system & game integration
│   │   ├── Framework/       Knockout, DI, utilities, Perlin noise
│   │   └── Unknown/         Game engine (~52 files)
│   ├── Styles/              LESS stylesheets
│   ├── Fonts/               DejaVuSansMono, Inter
│   └── Images/              Logos, thumbnails, icons
├── Controllers/             ASP.NET Core controllers
├── Docs/                    Game engine documentation
├── Tools/                   Build scripts (PowerShell)
├── wwwroot/                 Published static assets
├── NemoEsuriat.csproj       .NET project config
├── tsconfig.json            TypeScript config
└── package.json             Node.js dependencies
```

## Getting Started

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/)
- TypeScript (`npm install -g typescript`)

### Setup

```bash
npm install
dotnet build
dotnet run
```

## Development

### Launch Profiles

The app can be run via `dotnet run` using the profiles defined in [launchSettings.json](Properties/launchSettings.json):

- **http** — `http://localhost:5001`
- **https** — `https://localhost:7097` (also available on port 5001)

```bash
dotnet run --launch-profile http
dotnet run --launch-profile https
```

### VS Code Tasks

Three background tasks are available in [tasks.json](.vscode/tasks.json) for live development:

| Task                | Description                                              |
|---------------------|----------------------------------------------------------|
| **Watch Less**       | Auto-compiles LESS stylesheets on change                |
| **Watch Typescript** | Auto-compiles TypeScript on change                      |
| **Build Blog**       | Generates blog HTML from source into `wwwroot/HTML/GeneratedViews/` |

Run them from the VS Code command palette (`Ctrl+Shift+P` → "Tasks: Run Task").

### VS Code Launch Configurations

Two debug configurations are available in [launch.json](.vscode/launch.json):

- **C#: Nemo Esuriat Full Debug** — Launches the full .NET project with debugger attached
- **Debug one ts file** — Runs the currently open TypeScript/JS file in Node for quick debugging

## License

ISC
