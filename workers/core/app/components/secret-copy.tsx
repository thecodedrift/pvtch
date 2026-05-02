import { useState, useCallback } from 'react';
import { Eye, EyeOff, Copy, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SecretCopyProps {
  value: string;
  className?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function SecretCopy({ value, className }: SecretCopyProps) {
  const [revealed, setRevealed] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = useCallback(async () => {
    // Clipboard API can reject for several reasons: permissions denied,
    // insecure context (no HTTPS), document not focused, or OBS browser
    // source quirks. Catching keeps a rejection from becoming an unhandled
    // promise rejection and lets us surface a clear failure state.
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }, [value]);

  return (
    <div
      className={cn(
        'flex items-center gap-0 rounded-md border border-input bg-muted',
        className
      )}
    >
      <div className="flex-1 overflow-x-auto px-3 py-2 font-mono text-xs">
        {revealed ? value : '•'.repeat(Math.min(value.length, 40))}
      </div>
      <div className="flex shrink-0 border-l border-input">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto rounded-none px-2 py-2"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide value' : 'Reveal value'}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto rounded-none px-2 py-2"
          onClick={() => void handleCopy()}
          aria-label={
            copyState === 'failed' ? 'Copy failed' : 'Copy to clipboard'
          }
          title={
            copyState === 'failed'
              ? "Couldn't copy — your browser blocked clipboard access. Reveal and copy manually."
              : 'Copy to clipboard'
          }
        >
          {copyState === 'copied' && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {copyState === 'failed' && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          {copyState === 'idle' && <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
