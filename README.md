# PVTCH: Streamtools

A colection of tools for streamers, built to be (mostly) indestructible and cost me (theCodeDrift) very little to host so it can stay up forever.

Check the tools out at https://www.pvtch.com

## 🚀 Project Structure

Inside of PVTCH, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── components/ui/*   <= imported components from shadcn
│   │   └── icons/*       <= lucide icons (https://www.shadcn.io/icons/lucide)
│   └── hooks/*           <= react hooks
│   └── layouts/*         <= Astro layouts
│   └── lib/*             <= reusable libraries (shadcn and others)
│   └── pages/
│   │   └── *.astro       <= An astro route. A components/* directory is also common here
│   └── styles/           <= global styles and css variables
│
└── + other project config at the root
```

This is (mostly) a standard Astro project structure, with an emphasis on `client:only` to move logic into the browser and into React. This is so PVTCH can run without any servers other than a static host and a key-value store.

The PVTCH k/v store is a Cloudflare Worker, which you can find at `api.pvtch.com`. Key/Value pairs expire automatically after 24 hours and are capped at 16kb.

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

# TODOs

AKA fun projects we'd like to add

- [ ] Coworking "virtual office" that cycles through streamers using twitch embeds
- [ ] Multimodal Translator https://github.com/elizabethsiegle/cfworkers-ai-translate/blob/main/src/index.js / @cf/meta/m2m100-1.2b which offers about $0.34/750k words
