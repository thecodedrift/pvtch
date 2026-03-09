import { Link } from 'react-router';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useCookie from '@/hooks/use-cookie';

export function meta() {
  return [{ title: 'Private Instance - PVTCH' }];
}

function SignOutButton() {
  const [token, , removeToken] = useCookie('pvtch_token');
  const nameHook = useCookie('pvtch_name');
  const removeName = nameHook[2];

  if (!token) return;

  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={() => {
        removeToken();
        removeName();
        globalThis.window?.location.reload();
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}

export default function Private() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Private Instance</h1>
        <p className="text-muted-foreground">
          This PVTCH instance is restricted to specific users. If you believe
          you should have access, contact the instance operator.
        </p>
        <SignOutButton />
        <p className="text-sm text-muted-foreground">
          Want your own?{' '}
          <Link
            to="/howto/deploy-your-own"
            className="text-brand underline underline-offset-4 hover:text-brand/80"
          >
            Host your own PVTCH instance
          </Link>
        </p>
      </div>
    </div>
  );
}
