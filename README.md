# PVTCH: Streamtools

A colection of tools for streamers, built to be (mostly) indestructible and cost me (theCodeDrift) very little to host so it can stay up forever.

Check the tools out at https://www.pvtch.com

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

Any static assets, like images, can be placed in the `public/` directory.

Generally, you'll make a `/<tool>/index.astro` file for the tool's configuration page, and a `/<tool>/live.astro` file for the tool's output page.

There's utilities for parsing the query string from the `window.location`. Generally, we don't want to store state (no localStorage, no databases). This lets the streamer bring any bot they'd like to the party, and the tool "just works" as an OBS browser source.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `pnpm install`         | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |
