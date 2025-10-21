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

  useEffect(() => {
    if (!(globalThis as GlobalThisWithTwitch).Twitch) {
      console.error("Twitch embed script not loaded");
      return;
    }

    const options = {
      width: 1920,
      height: 1080,
      channel: user,
      // only needed if your site is also embedded on embed.example.com and othersite.example.com
      parent: ["pvtch.com", "www.pvtch.com", "localhost:4322"],
      autoplay: true,
      muted: true,
    };

    const player = new (globalThis as GlobalThisWithTwitch).Twitch.Player(
      "twitch-embed",
      options,
    );
  }, []);

  return <div id="twitch-embed"></div>;
};
