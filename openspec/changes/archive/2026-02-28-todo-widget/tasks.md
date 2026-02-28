## 1. Twitch Chat Integration

- [x] 1.1 Create `app/hooks/use-comfy.ts` wrapping ComfyJS with EventEmitter3 for typed Twitch chat events (singleton per channel)
- [x] 1.2 Create `app/atoms/comfy.ts` with nanostore atoms for global ComfyJS instance and chat channel state

## 2. Task Management Logic

- [x] 2.1 Implement `addTask` function creating tasks with username, description, nanoid, timestamp, and default focus/completed state
- [x] 2.2 Implement `completeTask` function marking tasks by 1-based index within user's sorted task list
- [x] 2.3 Implement `focusTask` function setting focus timestamp for priority sorting
- [x] 2.4 Implement `resetTasks` function clearing all tasks or a specific user's tasks
- [x] 2.5 Implement `cleanTasks` function removing all completed tasks
- [x] 2.6 Implement `taskSorter` with priority: broadcaster first, username alpha, incomplete before complete, focus timestamp, then creation time

## 3. Chat Command Handler

- [x] 3.1 Wire up ComfyJS `onCommand` events to dispatch add/done/focus/reset/clear commands
- [x] 3.2 Support semicolon-separated multiple task input for add command
- [x] 3.3 Support multiple index completion for done command, defaulting to index 1
- [x] 3.4 Restrict reset and clear commands to mod/broadcaster flags
- [x] 3.5 Per-user task count limiting with configurable max (default 5)

## 4. OBS Source Component

- [x] 4.1 Create `app/routes/sources/todo.$channel.tsx` with loader extracting channel from URL params
- [x] 4.2 Parse URL query parameters with Zod for customizable commands, colors, count, help, and debug
- [x] 4.3 Implement auto-scrolling with ResizeObserver detection and duplicated content for seamless CSS animation loop
- [x] 4.4 Render task list grouped by username with numbered indexes, check icons, strikethrough, and opacity states
- [x] 4.5 Display help header with command names, conditionally shown via `help` parameter
- [x] 4.6 Persist tasks in localStorage via `rooks` useLocalstorageState hook

## 5. Supporting Components

- [x] 5.1 Create `app/components/icons/check.tsx` with check mark SVG icon
- [x] 5.2 Create `app/hooks/use-no-theme.ts` for disabling theme on bare embed pages
