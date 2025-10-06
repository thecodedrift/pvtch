import { useHashParameters } from "@/hooks/useHashParameters";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Options } from "./types";

export const Render: React.FC = () => {
  const options = useHashParameters<Options>({
    bgcolor: "000000",
    fgcolor1: "5e62ff",
    fgcolor2: "",
    goal: "100",
    progress: "0",
    goaltext: "Goal",
  });

  const completedRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [shifting, setShifting] = useState(false);
  const [translate, setTranslate] = useState(0);

  // set colors
  const fgcolor1 = options.fgcolor1 ?? "5e62ff";
  const fgcolor2 =
    options.fgcolor2 && options.fgcolor2.length > 0
      ? options.fgcolor2
      : fgcolor1;

  // convert progress and goal to numbers, remove non-numeric characters
  const progress = Math.max(
    0,
    parseFloat((options.progress ?? "").replace(/[^0-9.-]/g, "")) || 0,
  );
  const goal = Math.max(
    1,
    parseFloat((options.goal ?? "").replace(/[^0-9.-]/g, "")) || 1,
  );
  const percent = Math.min(100, (progress / goal) * 100);

  /*
  The progress bar is rendered as a horizontal bar with absolute positioning

  |-----------------------+-----------------------|
  | completed             |                       |
  | fgcolor1 to fgcolor2  |                       |
  | text glued to the     |                       |
  | right edge of complete|                       |
  |                       | remaining             |
  |                       | bgcolor               |
  |-----------------------+-----------------------|

  [bgcolor | fgcolor1-fgcolor2]
  the % completed is determined by progress/goal
  make the goal text appear right of the bgcolor region unless it's wide enough to fit inside
  then pin to the lft
  */

  // the text style should be the color of fg1, with a stroke of bgcolor on the outside
  const textStyle = {
    fontSize: `20vh`,
    color: `#${shifting ? options.bgcolor : fgcolor1}`,
    WebkitTextStroke: `0.25em #${shifting ? fgcolor1 : options.bgcolor}`,
    paintOrder: "stroke fill",
  };

  // Measure container and text to determine if we need absolute positioning
  useEffect(() => {
    const checkTextFit = () => {
      if (!completedRef.current) return;

      const maxInfoContainer = Math.max(
        0,
        ...[goalRef.current, progressRef.current]
          .filter((v) => v !== null)
          .map((v) => v.offsetWidth),
      );
      const containerWidth = completedRef.current.offsetWidth;
      const mustTranslate = maxInfoContainer > containerWidth;

      // Calculate how much we need to translate to make the text fully visible
      // We only need to translate by the amount that's currently hidden
      let translateAmount = maxInfoContainer - containerWidth;

      // Ensure we don't translate so far that the text goes off the right edge of the screen
      const maxTranslate =
        document.body.clientWidth - containerWidth - maxInfoContainer;
      if (translateAmount > maxTranslate) {
        translateAmount = maxTranslate;
      }

      // Don't translate if it would make things worse
      if (translateAmount < 0) {
        translateAmount = 0;
      }

      setShifting(mustTranslate);
      setTranslate(mustTranslate ? translateAmount : 0);
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
          --my-gradient: linear-gradient(25deg, #${fgcolor1} 0%, #${fgcolor2} 100%);
        }
        `}
      </style>
      <div className="absolute top-0 left-0 h-screen w-screen overflow-hidden">
        <div className="flex h-full w-full flex-row items-center">
          <div
            id="completed"
            ref={completedRef}
            style={{
              width: `${percent}%`,
              background: `var(--my-gradient)`,
              position: "relative",
            }}
            className="h-full w-full transition-all ease-in-out"
          >
            <div
              id="info"
              style={{
                ...textStyle,
                transform: `translateX(${translate}px)`,
              }}
              className={`flex h-full w-full flex-col justify-center gap-[0.1em] px-2 font-bold whitespace-nowrap transition-all ease-in-out ${
                shifting ? "items-start" : "items-end"
              }`}
            >
              {options.goaltext && options.goaltext.length > 0 && (
                <div id="goal" ref={goalRef}>
                  {options.goaltext}
                </div>
              )}
              <div id="progress" ref={progressRef}>
                {options.progress ?? ""}
              </div>
            </div>
          </div>
          <div
            id="remaining"
            className="h-full w-full flex-grow transition-all ease-in-out"
            style={{
              backgroundColor: `#${options.bgcolor}`,
            }}
          ></div>
        </div>
      </div>
    </>
  );
};
