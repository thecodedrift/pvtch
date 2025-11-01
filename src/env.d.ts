interface ImportMetaEnv {
  readonly PUBLIC_PVTCH_API?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:starlight/components/SocialIcons" {
  const SocialIcons: any;
  export default SocialIcons;
}

declare module "virtual:starlight/components/LanguageSelect" {
  const LanguageSelect: any;
  export default LanguageSelect;
}

declare module "virtual:starlight/components/Search" {
  const Search: any;
  export default Search;
}

declare module "virtual:starlight/components/SiteTitle" {
  const SiteTitle: any;
  export default SiteTitle;
}

declare module "virtual:starlight/components/ThemeSelect" {
  const ThemeSelect: any;
  export default ThemeSelect;
}

declare module "virtual:starlight/user-config" {
  const config: any;
  export default config;
}
