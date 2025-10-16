const DEFAULT_PUBLIC_PVTCH_API = "https://api.pvtch.com";

export const PVTCH_API =
  import.meta.env.PUBLIC_PVTCH_API ?? DEFAULT_PUBLIC_PVTCH_API;
