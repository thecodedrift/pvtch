import type { Route } from './+types/1s.$channel';
import { useLoaderData, data } from 'react-router';
import { useComfy, type ComfyEvents } from '@/hooks/use-comfy';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router';
import z from 'zod';
import { useNoTheme } from '@/hooks/use-no-theme';
import { useDocumentVisibilityState, useIntervalWhen } from 'rooks';
import { Lock, Timer } from 'lucide-react';

/*
TODOs
- [x] Repeat voting state on/off
- [x] "Current Config" merging
- [x] !1s mod commands
  - [x] Duration/Cooldown
  - [x] Mode one|many
  - [x] Clear
- [ ] Callback URL trigger

FEATURE CREEP
- [x] Allow non-numeric voting (fixed list, param only, comma separated)
  - [x] Show vote options when enabled (top bar, left side)
*/

const DEFAULTS = {
  bg: 'rgb(34, 34, 34)',
  bar: 'rgb(216, 228, 103)',
  text: 'white',
  duration: 60,
  cooldown: 30,
  repeat: false,
  choices: [],
  callback: undefined,
} as const;

const parameterParser = z
  .object({
    bg: z.string().optional().default(DEFAULTS.bg),
    text: z.string().optional().default(DEFAULTS.text),
    bar: z.string().optional().default(DEFAULTS.bar),
    duration: z
      .string()
      .optional()
      .default(`${DEFAULTS.duration}`)
      .transform((input) => {
        const value = Number.parseInt(input, 10);
        if (Number.isNaN(value) || value <= 0) {
          return DEFAULTS.duration;
        }
        return value;
      }),
    cooldown: z
      .string()
      .optional()
      .default(`${DEFAULTS.cooldown}`)
      .transform((input) => {
        const value = Number.parseInt(input, 10);
        if (Number.isNaN(value) || value <= 0) {
          return DEFAULTS.cooldown;
        }
        return value;
      }),
    repeat: z
      .string()
      .optional()
      .default('false')
      .transform((input) => {
        return input.toLocaleLowerCase() === 'true';
      }),
    choices: z
      .string()
      .optional()
      .default('')
      .transform((input) => {
        if (!input) {
          return [];
        }
        const options = input
          .split(',')
          .map((s) => s.trim())
          .filter((v) => v && v.length > 0);
        return options.length > 0 ? options : [];
      }),
    callback: z
      .string()
      .optional()
      .transform((input) => {
        // try to parse URL as valid, return undefined if missing or invalid
        if (!input) return;
        try {
          return new URL(input).toString();
        } catch {
          return;
        }
      }),
  })
  .optional()
  .default({
    ...DEFAULTS,
    choices: [],
  });

// turns 11111111 into "1"
// turns 1.1 into "1"
// normalizes our input numbers, supporting memish format
const numericNormalizer = (input: string) => {
  const trimmed = input.trim();

  // if all the same number, it's just the first number
  if (/^(\d)\1*$/.test(trimmed)) {
    return trimmed[0];
  }

  // if it's a decimal number, take the integer part
  const integerPart = trimmed.split('.')[0];
  if (/^\d+$/.test(integerPart)) {
    return integerPart;
  }

  // if it's just a number, return it
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // otherwise, return nothing
  return;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nobody = {
  broadcaster: false,
  mod: false,
  founder: false,
  subscriber: false,
  vip: false,
  highlighted: false,
  customReward: false,
};
const fakeflags = {
  id: 'fakeid',
  channel: 'fakechannel',
  roomId: 'fakerroomid',
  messageType: 'chat',
  isEmoteOnly: false,
  userId: 'fakeuserid',
  username: 'fakeusername',
  displayName: 'fakeusername',
  userColor: '#ffffff',
  userBadges: [],
  customRewardId: '',
  flags: [],
  timestamp: `${Date.now()}`,
};

// Loader: fetch url param to loader data, before initializing comfy
// eslint-disable-next-line @typescript-eslint/require-await
export async function loader({
  request,
  params,
  context: _context,
}: Route.LoaderArgs) {
  const { channel } = params;

  return data({
    channel,
  });
}

/**
 * Primary Todo Sourc Component
 */
export default function TodoSource() {
  useNoTheme();
  const isDocumentVisible = useDocumentVisibilityState();
  const loaderData = useLoaderData<typeof loader>();
  const comfy = useComfy(loaderData.channel);
  const [rawParameters] = useSearchParams();
  const [votes, setVotes] = useState<Map<string, number>>(new Map());
  const [voters, setVoters] = useState<Map<string, string>>(new Map()); // username -> option
  const [startTime, setStartTime] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [overrides, setOverrides] = useState<
    Partial<z.infer<typeof parameterParser>>
  >({});
  const parameters = useMemo(() => {
    const fromURL = parameterParser.parse(
      Object.fromEntries(rawParameters.entries())
    );
    const result = { ...fromURL };

    // for each key in fromURL, if an override exists, use it instead
    for (const key of Object.keys(fromURL) as (keyof typeof fromURL)[]) {
      if (overrides[key] !== undefined) {
        // @ts-expect-error we know this is fine
        result[key] = overrides[key]!;
      }
    }

    console.log('Parameters', result);

    return result;
  }, [overrides]);

  useIntervalWhen(
    () => {
      setNow(Date.now());
    },
    1000, // run callback every 1 second
    isDocumentVisible === 'visible'
  );

  const votingState = useMemo(() => {
    if (startTime === 0) {
      return 'ready';
    }

    if (
      now >
      startTime + parameters.duration * 1000 + parameters.cooldown * 1000
    ) {
      return 'ready';
    }

    if (now > startTime + parameters.duration * 1000) {
      return 'locked';
    }

    if (now > startTime) {
      return 'voting';
    }

    return 'ready';
  }, [now, startTime, parameters]);

  // console.log(parameters);

  const vote = useCallback(
    (name: string, option: string) => {
      const choice =
        parameters.choices.length > 0
          ? // if choices are defined, only allow those options, find the match ignoring case
            parameters.choices.find(
              (c) => c.toLocaleLowerCase() === option.toLocaleLowerCase()
            )
          : numericNormalizer(option);

      if (!choice) {
        return;
      }

      const hasVoted = voters.has(name.toLowerCase());
      const canVote =
        (parameters.repeat || !hasVoted) &&
        (votingState === 'voting' || votingState === 'ready');

      if (!canVote) {
        return;
      }

      if (votes.size === 0) {
        setStartTime(Date.now());
      }

      setVoters((last) => {
        const next = new Map(last);
        next.set(name.toLowerCase(), choice);
        return next;
      });

      setVotes((last) => {
        const next = new Map(last);
        const currentVotes = next.get(choice) ?? 0;
        next.set(choice, currentVotes + 1);
        return next;
      });
    },
    [voters, parameters, votingState]
  );

  const voteWrapper = useEffectEvent(vote);

  useEffect(() => {
    if (!comfy) return;

    const onCommand: ComfyEvents['command'] = (
      user,
      command,
      message,
      flags,
      extra
    ) => {
      if (!flags.broadcaster && !flags.mod) {
        console.log('ignored', flags);
        return;
      }

      const args = message
        .split(/ /g)
        .map((s) => s.trim().toLocaleLowerCase())
        .filter((v) => v && v.length > 0);
      switch (command.toLocaleLowerCase() + ' ' + args[0]) {
        case '1s timer': {
          const options = (args[1]?.split('/') ?? [])
            .map((v) => Number.parseInt(v, 10))
            .filter((v) => !Number.isNaN(v));
          const [duration, cooldown] = options;

          setOverrides({
            duration: duration && duration > 0 ? duration : undefined,
            cooldown: cooldown && cooldown > 0 ? cooldown : undefined,
          });
          break;
        }
        case '1s vote': {
          let mode: string | undefined = args[1];
          if (mode !== 'one' && mode !== 'many') {
            mode = undefined;
          }
          setOverrides({
            repeat: mode === 'many' ? true : mode === 'one' ? false : undefined,
          });
          break;
        }
        case '1s list': {
          const list = message
            .split(/ /g)
            .map((s) => s.trim())
            .filter((v, index) => index !== 0 && v && v.length > 0)
            .join(' ')
            .split(',')
            .map((s) => s.trim())
            .filter((v) => v && v.length > 0);

          setOverrides({
            choices: list.length > 0 ? list : undefined,
          });
          break;
        }
        case '1s reset': {
          setVotes(new Map());
          setVoters(new Map());
          setStartTime(0);
          break;
        }
        default: {
          console.log('Unknown command', {
            user,
            command,
            message,
            flags,
            extra,
          });
        }
      }
    };

    const onChat: ComfyEvents['chat'] = (user, message, flags, extra) => {
      const firstWord = message.split(/ /)[0].trim().toLocaleLowerCase();
      voteWrapper(user, firstWord);
    };

    comfy.events.on('command', onCommand);
    comfy.events.on('chat', onChat);

    return () => {
      comfy.events.off('command', onCommand);
      comfy.events.off('chat', onChat);
    };
  }, [comfy, voteWrapper, setVoters, setStartTime]);

  useEffect(() => {
    if (isDocumentVisible !== 'visible' || !comfy) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.window as unknown as { sendComfyEvent: any }).sendComfyEvent = (
      ...args: unknown[]
    ) => {
      if (args.length > 0) {
        // @ts-expect-error very intentional ignore. used to force tests
        comfy.events.emit(args[0] as string, ...args.slice(1));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.window as unknown as { simulate: any }).simulate = () => {
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const simulate = async () => {
        comfy.events.emit(
          'chat',
          'SimulatedUser1',
          '1',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser2',
          '1',
          nobody,
          false,
          fakeflags
        );
        await sleep(1000);
        comfy.events.emit(
          'chat',
          'SimulatedUser3',
          '2',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser4',
          '69',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser5',
          '1',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser6',
          '1',
          nobody,
          false,
          fakeflags
        );
        await sleep(1500);
        comfy.events.emit(
          'chat',
          'SimulatedUser7',
          '2',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser8',
          '2',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser9',
          '3',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUser0',
          '1',
          nobody,
          false,
          fakeflags
        );
        await sleep(1000);
        comfy.events.emit(
          'chat',
          'SimulatedUsera',
          '4',
          nobody,
          false,
          fakeflags
        );
        comfy.events.emit(
          'chat',
          'SimulatedUserb',
          '1',
          nobody,
          false,
          fakeflags
        );
      };
      simulate().catch(console.error);
    };
  }, [isDocumentVisible, comfy]);

  const options = [...votes.entries()]
    // const options = [...fakedb.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([option, votes]) => ({ option, votes }));

  const totalVotes = options.reduce((total, { votes }) => total + votes, 0);

  // console.log(options);

  return (
    <div
      className="w-screen h-screen overflow-hidden rounded-sm flex flex-col"
      style={{
        backgroundColor: parameters.bg,
        color: parameters.text,
      }}
    >
      <div
        className="px-4 flex flex-row items-center justify-start pb-4"
        style={{
          fontSize: 'clamp(10px, 5cqh, 40px)',
        }}
      >
        <div className="grow pt-2">
          {parameters.choices.length > 0 ? (
            <>
              {parameters.choices.map((choice, index) => (
                <span
                  key={choice}
                  className="px-2 py-1 mr-2 rounded-md bg-white/20"
                >
                  {choice}
                </span>
              ))}
            </>
          ) : undefined}
        </div>
        {votingState === 'ready' ? (
          <div className="flex flex-row items-center">
            <div className="h-5 w-5"></div>
            <span className="opacity-0">Ready</span>
          </div>
        ) : votingState === 'locked' ? (
          <div>
            <Lock className="inline-block h-5 w-5" />
          </div>
        ) : (
          <div className="flex flex-row items-center">
            <Timer className="inline-block mr-1 h-5 w-5" />
            <span
              style={{
                fontSize: 'clamp(10px, 5cqh, 40px)',
              }}
            >
              {`${Math.max(
                0,
                Math.ceil((startTime + parameters.duration * 1000 - now) / 1000)
              )}s`}
            </span>
          </div>
        )}
      </div>
      <div className="relative w-full h-full">
        {options.map(({ option, votes }, index) => {
          const offset = index * 100;
          return (
            <div
              key={option}
              className="absolute left-0 top-0 h-[25%] pl-2 pr-4 flex flex-col items-center w-full [container-type:size] transition-all ease-in-out duration-300"
              style={{
                transform: `translateY(${offset}%)`,
                opacity: votingState === 'locked' && index > 0 ? 0.5 : 1,
              }}
            >
              <div
                className="w-full font-bold px-2 pb-1"
                style={{
                  fontSize: 'clamp(20px, 7cqh, 40px)',
                  letterSpacing: '2px',
                }}
              >
                <span>{option}</span>
                <span className="pl-1 opacity-80 font-normal text-[80%]">
                  ({votes})
                </span>
              </div>
              <div className="flex flex-row items-center w-full">
                <div
                  className="border-1 border-[#111111] transition-all ease-in-out rounded-md duration-300"
                  style={{
                    backgroundColor: parameters.bar,
                    width: `${(votes / totalVotes) * 100}%`,
                    // height is min 4px otherwise 10% of parent
                    height: 'max(20%, 10px)',
                  }}
                ></div>
                <div className="flex-grow transition-all ease-in-out duration-300">
                  {/* pads out remainder of bar */}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
