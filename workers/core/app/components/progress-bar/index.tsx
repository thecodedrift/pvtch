import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { defaults, type Options } from './options';
import { cn } from '@/lib/utils';

export const BasicBar: React.FC<
  Options & {
    progress: number;
    embedded?: boolean;
  }
> = (props) => {
  const completedRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [infoPinned, setPinInfo] = useState(true);

  const options = {
    bgcolor: props?.bg ?? defaults.bg,
    fgcolor1: props?.fg1 ?? defaults.fg1,
    fgcolor2: props?.fg2 ?? defaults.fg1, // fall back to fgcolor1
    goal: Math.max(1, props.goal),
    progress: props.progress ?? 0,
    decimal: props.decimal,
    text: props?.text ?? defaults.text,
  };
  const percent = Math.min(100, (options.progress / options.goal) * 100);

  // the text style should be the color of fg1, with a stroke of bgcolor on the outside
  const textStyle = {
    fontSize: options.text && options.text.length > 0 ? `30cqh` : '60cqh',
    color: `${infoPinned ? options.bgcolor : options.fgcolor1}`,
    WebkitTextStroke: `0.25em ${infoPinned ? options.fgcolor1 : options.bgcolor}`,
    paintOrder: 'stroke fill',
  };

  /**
   * Whenever the size of the completed bar changes, check the text and see if our
   * positioning rules need to change for the goal text
   */
  useEffect(() => {
    const checkTextFit = () => {
      if (!completedRef.current) return;

      const infoWidth = Math.max(
        0,
        ...[goalRef.current, progressRef.current]
          .filter((v) => v !== null)
          .flatMap((v) => [v.scrollWidth, v.clientWidth, v.offsetWidth]),
      );

      const padding = 24; // px, from px-6

      const filledWidth = completedRef.current.offsetWidth;
      const pin = infoWidth + padding * 2 > filledWidth;

      setPinInfo(pin);
    };

    // Check on mount and when options change
    checkTextFit();

    // Set up resize observer to check when sizes changes
    const completedObserver = new ResizeObserver(checkTextFit);
    if (completedRef.current) {
      completedObserver.observe(completedRef.current);
    }

    const goalObserver = new ResizeObserver(checkTextFit);
    if (goalRef.current) {
      goalObserver.observe(goalRef.current);
    }

    const progressObserver = new ResizeObserver(checkTextFit);
    if (progressRef.current) {
      progressObserver.observe(progressRef.current);
    }

    return () => {
      completedObserver.disconnect();
      goalObserver.disconnect();
      progressObserver.disconnect();
    };
  }, []);

  return (
    <>
      <style>
        {`
        :root {
          --my-gradient: linear-gradient(25deg, ${options.fgcolor1} 0%, ${options.fgcolor2} 100%);
        }
        `}
      </style>
      <div
        className={cn(
          'absolute top-0 left-0 overflow-hidden',
          props.embedded ? 'h-full w-full' : 'h-screen w-screen',
        )}
      >
        <div className="flex h-full w-full flex-row items-center">
          <div
            id="completed"
            ref={completedRef}
            style={{
              width: `${percent}%`,
              background: `var(--my-gradient)`,
              containerType: 'size',
            }}
            className="relative h-full w-full transition-all ease-in-out"
          >
            <div
              id="info"
              style={{
                ...textStyle,
              }}
              className={cn(
                `px-6 font-bold whitespace-nowrap transition-all ease-in-out`,
              )}
            >
              <div
                className={cn(
                  'flex h-full w-full flex-col justify-center gap-[0.1em]',
                  infoPinned ? 'items-start' : 'items-end',
                )}
              >
                {options.text && options.text.length > 0 && (
                  <div id="goal" ref={goalRef}>
                    {options.text}
                  </div>
                )}
                <div id="progress" ref={progressRef} className="font-black">
                  <span className="pr-[0.3em]">
                    {props.prefix}
                    {options.progress.toFixed(options.decimal)}
                  </span>
                  <span className="pr-[0.3em]">/</span>
                  {props.prefix}
                  {options.goal.toFixed(0) ?? ''}
                </div>
              </div>
            </div>
          </div>
          <div
            id="remaining"
            className="h-full w-full flex-grow transition-all ease-in-out"
            style={{
              backgroundColor: `${options.bgcolor}`,
              width: `${100 - percent}%`,
            }}
          ></div>
        </div>
      </div>
    </>
  );
};
