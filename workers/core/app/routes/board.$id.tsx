import { useEffect, useState } from 'react';
import { data, useLoaderData, useRevalidator } from 'react-router';
import { useResizeObserverRef } from 'rooks';
import type { Route } from './+types/board.$id';
import { cloudflareEnvironmentContext } from '@/context';
import { parseBoardId } from '@/lib/board-id';
import { renderBoardMarkdown } from '@/lib/markdown';
import { resolveBoardTheme } from '@/lib/board-themes';
import { useNoTheme } from '@/hooks/use-no-theme';

const POLL_INTERVAL = 3000; // ms
const MIN_SCROLL_DURATION = 12; // seconds, fastest the scroll cycle ever runs
const MAX_SCROLL_DURATION = 120;
const SCROLL_PIXELS_PER_SECOND = 35; // larger = slower

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@700&display=swap',
  },
];

export function meta({ data: meta }: Route.MetaArgs) {
  if (!meta?.found) return [{ title: 'Board not found' }];
  return [{ title: `Board: ${meta.name}` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const theme = resolveBoardTheme(url.searchParams.get('theme'));

  const parsed = parseBoardId(params.id);
  if (!parsed) {
    return data({ found: false as const, theme }, { status: 404 });
  }

  const env = context.get(cloudflareEnvironmentContext);
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${parsed.userId}`)
  );

  using boardPlugin = await stub.board();
  const board = await boardPlugin.read(parsed.slotId);
  if (!board) {
    return data({ found: false as const, theme }, { status: 404 });
  }

  const safeHtml = renderBoardMarkdown(board.content);

  return data({
    found: true as const,
    name: board.name,
    safeHtml,
    version: board.version,
    updatedAt: board.updatedAt,
    theme,
  });
}

export default function BoardSource() {
  useNoTheme();
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [overflows, setOverflows] = useState(false);
  const [scrollDuration, setScrollDuration] = useState(MIN_SCROLL_DURATION);

  // Measure the (single-copy) content height. When it exceeds the viewport,
  // enable infinite-scroll mode and render the content twice so the loop is
  // seamless. Recompute on every content/window change.
  const [contentRef] = useResizeObserverRef((entries) => {
    if (globalThis.window === undefined) return;
    const entry = entries[0];
    if (!entry) return;
    // When `overflows` is true we render the content twice inside the wrapper,
    // so the observed height is ~2x the single-copy height. Halve it to get
    // the single-copy height for the threshold check.
    const observed = entry.contentRect.height;
    const singleHeight = overflows ? observed / 2 : observed;
    const windowHeight = globalThis.window.innerHeight;
    setOverflows(singleHeight > windowHeight);
    setScrollDuration(
      Math.min(
        MAX_SCROLL_DURATION,
        Math.max(MIN_SCROLL_DURATION, singleHeight / SCROLL_PIXELS_PER_SECOND)
      )
    );
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (revalidator.state === 'idle') {
        void revalidator.revalidate();
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [revalidator]);

  const { theme } = loaderData;
  const containerStyle: React.CSSProperties = {
    background: theme.background,
    color: theme.color,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fontWeight: theme.fontWeight,
    padding: theme.padding,
    borderRadius: theme.borderRadius,
    // Container fits its content (min-height) up to viewport height (cap),
    // then content scrolls inside via the duplicate-and-translate trick below.
    maxHeight: '100vh',
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  if (!loaderData.found) {
    return (
      <div style={containerStyle} className="w-full">
        <div className="board-content">
          <p>Board not found</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="w-full">
      <div
        ref={contentRef}
        className={overflows ? 'animate-infinite-scroll' : ''}
        style={{
          animationDuration: overflows ? `${scrollDuration}s` : undefined,
        }}
      >
        <div
          className="board-content"
          dangerouslySetInnerHTML={{ __html: loaderData.safeHtml }}
        />
        {overflows && (
          <div
            className="board-content"
            dangerouslySetInnerHTML={{ __html: loaderData.safeHtml }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
