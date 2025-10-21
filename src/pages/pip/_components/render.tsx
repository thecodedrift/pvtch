import { useHashParameters } from "@/hooks/useHashParameters";
import { useEffect } from "react";

type GlobalThisWithTwitch = typeof globalThis & { Twitch: any };

type Options = {
  user?: string;
};

const defaults = {
  user: "theCodeDrift",
};

export const Render: React.FC = () => {
  const params = useHashParameters<Options>({});
  const user = (params.user ?? defaults.user).replace(/[^a-z0-9_]/gi, "");

  if (!user || user.length === 0) {
    return null;
  }

  return (
    <iframe
      src="https://player.twitch.tv/?channel=theCodeDrift&parent=www.pvtch.com&muted=true&autoplay=true"
      width="1920"
      height="1080"
    ></iframe>
  );
};
