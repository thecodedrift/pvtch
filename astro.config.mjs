// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://www.pvtch.com",
  integrations: [
    react(),
    starlight({
      title: "PVTCH: Privacy-First Twitch Tools",
      logo: {
        src: "./public/pvtch.svg",
        replacesTitle: true,
      },
      customCss: [
        // Relative path to your custom CSS file
        "./src/styles/globals.css",
      ],
      components: {
        // Override the default header with our custom header
        Header: "./src/components/Header.astro",
        // Custom Page Frame for Sonners etc
        PageFrame: "./src/components/PageFrame.astro",
      },
      sidebar: [
        {
          label: "Widgets",
          items: [{ label: "Progress Bar", slug: "widgets/progress" }],
        },
        {
          label: "Helpers",
          items: [{ label: "Lingo", slug: "helpers/lingo" }],
        },
        {
          label: "Support PVTCH",
          items: [
            { label: "GitHub", link: "https://github.com/theCodeDrift/pvtch" },
            { label: "Donate", link: "https://ko-fi.com/codedrift" },
          ],
        },
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/theCodeDrift/pvtch",
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
