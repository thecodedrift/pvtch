import { useState, useCallback } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SecretCopyProps {
  value: string;
  className?: string;
}

export function SecretCopy({ value, className }: SecretCopyProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
