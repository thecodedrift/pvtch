interface ImportMetaEnv {
  readonly PUBLIC_PVTCH_API?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
