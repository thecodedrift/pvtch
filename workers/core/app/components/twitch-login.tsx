import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { TwitchIcon } from '@/components/ui/icons/twitch';
import useCookie from '@/hooks/use-cookie';

export const TwitchLogin = () => {
  const [userToken, _, removeUserToken] = useCookie('pvtch_token');
  const [loginUrl, setLoginUrl] = useState<URL | undefined>();
  const isLoggedIn = !!userToken;

  const handleLogout = useEventCallback(() => {
    removeUserToken();
    // reload the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const loginUrl = new URL(
      currentUrl.hostname === 'localhost'
        ? 'http://localhost:5173'
        : 'https://www.pvtch.com'
    );
    loginUrl.pathname = '/auth/start';
    setLoginUrl(loginUrl);
  }, []);

  return (
    <>
      {isLoggedIn ? (
        <Button onClick={handleLogout}>
          <span>Logout</span>
        </Button>
      ) : (
        <Button className="bg-[#8c45f7] text-white! hover:bg-[#9569f7]" asChild>
          <a href={loginUrl?.toString() ?? '#'}>
            <TwitchIcon />
            <span>Login With Twitch</span>
          </a>
        </Button>
      )}
    </>
  );
};
