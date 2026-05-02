import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function meta() {
  return [
    { title: 'Board — Markdown info card for your stream' },
    {
      name: 'description',
      content:
        'Create a markdown info card for your Twitch stream. Add it to OBS as a browser source. Share an edit URL with your mods so they can update it without logging in.',
    },
  ];
}

export default function BoardHowto() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Board</h1>
      <p className="text-muted-foreground">
        A small markdown info card you can put on stream — for rules, today's
        goal, current run notes, anything text-shaped. You get one URL for OBS
        and a separate edit URL you can hand to your mods. They don't need an
        account on this instance.
      </p>

      <h2>Create a board</h2>
      <ol>
        <li>
          Go to <Link to="/board">/board</Link> and click{' '}
          <strong>+ New board</strong>. You'll be redirected to the editor with
          a fresh edit URL.
        </li>
        <li>
          Type your content in the textarea. The right pane shows a live
          preview. Click <strong>Save</strong> when you're done.
        </li>
        <li>
          Set your editor name when prompted — it shows up in the history so you
          can tell who edited what.
        </li>
      </ol>

      <h2>Add it to OBS</h2>
      <ol>
        <li>
          Back on <Link to="/board">/board</Link>, copy your board's{' '}
          <strong>Public URL</strong>.
        </li>
        <li>
          In OBS, add a <strong>Browser Source</strong> and paste the URL.
        </li>
        <li>
          Set the width and height to match where it goes on your scene (e.g.
          600 × 400). The page is transparent so it overlays cleanly.
        </li>
        <li>
          Updates poll every 3 seconds — anything you save shows up on stream
          within a few seconds, no refresh needed.
        </li>
      </ol>

      <h2>Share with your mods</h2>
      <p>
        Copy the <strong>Edit URL</strong> for a board and DM it to a mod. They
        can open it in any browser, set their name, and start editing — no
        login. Multiple people can have it open; the editor warns when someone
        else has saved so you don't overwrite their work.
      </p>
      <p>
        If a mod stops modding (or the URL leaks), click{' '}
        <strong>Rotate edit key</strong> on <Link to="/board">/board</Link>. The
        old URL stops working immediately, and the public URL stays the same.
      </p>

      <h2>Limits</h2>
      <ul>
        <li>Up to 5 boards per account.</li>
        <li>Up to 5 KB of markdown per board.</li>
        <li>The last 10 saves are kept as history; older edits roll off.</li>
      </ul>

      <h2>Markdown</h2>
      <p>
        Boards support standard markdown: headings, lists, links, bold/italic,
        code spans and blocks. Raw HTML is not allowed — it renders as literal
        text. Links must be <code>http(s)://</code> or <code>mailto:</code>.
      </p>

      <div className="not-prose mt-8 flex gap-3">
        <Button asChild variant="action">
          <Link to="/board">Go to /board</Link>
        </Button>
      </div>
    </div>
  );
}
