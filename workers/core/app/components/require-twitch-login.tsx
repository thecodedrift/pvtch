import { TwitchLogin } from './twitch-login';

export default function RequireTwitchLogin() {
  return (
    <div className="flex flex-row items-center gap-2">
      To use this widget, please <TwitchLogin />
    </div>
  );
}
