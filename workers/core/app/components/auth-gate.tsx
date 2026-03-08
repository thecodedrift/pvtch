import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TwitchIcon } from '@/components/ui/icons/twitch';
import { useLoginUrl } from './twitch-login';

export function AuthGate({
  authenticated,
  children,
  reason,
}: {
  authenticated: boolean;
  children: ReactNode;
  reason?: ReactNode;
}) {
  if (authenticated) {
    return <>{children}</>;
  }

  return <AuthGatePrompt reason={reason} />;
}

function AuthGatePrompt({ reason }: { reason?: ReactNode }) {
  const loginUrl = useLoginUrl();

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6">
      {reason && <p className="mb-3 text-sm text-muted-foreground">{reason}</p>}
      <p className="mb-4 text-sm text-muted-foreground">
        We use Twitch login only to identify you. We don&apos;t request any
        permissions on your account. We store your Twitch username and a
        generated token, nothing else.
      </p>
      <Button className="bg-[#8c45f7] text-white! hover:bg-[#9569f7]" asChild>
        <a href={loginUrl}>
          <TwitchIcon />
          <span>Login with Twitch</span>
        </a>
      </Button>
    </div>
  );
}
