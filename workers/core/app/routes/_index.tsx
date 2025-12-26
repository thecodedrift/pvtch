import type { Route } from './+types/_index';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'PVTCH - Stream Tools' },
    { name: 'description', content: 'Free tools for streamers' },
  ];
}

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">PVTCH</h1>
      <p className="text-muted-foreground mb-8">Free tools for streamers</p>
      <div className="flex gap-4">
        <a
          href="/widgets/progress"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Progress Bar
        </a>
        <a
          href="/helpers/lingo"
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
        >
          Lingo Translator
        </a>
      </div>
    </div>
  );
}
