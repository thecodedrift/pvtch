import { DurableObject } from 'cloudflare:workers';
import {
  JobScheduler,
  type ScheduledJob,
  type JobSchedulerHost,
} from './helpers/job-scheduler';
import { Progress } from './plugins/progress';
import { Lingo } from './plugins/lingo';

/**
 * User - SQLite-backed Durable Object for per-user storage.
 * Keyed by "twitch:{userId}". Thin shell over plugins.
 */
export class User extends DurableObject<Env> implements JobSchedulerHost {
  private _progress: Progress;
  private _lingo: Lingo;
  private scheduler: JobScheduler;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    this._progress = new Progress(sql);
    this._lingo = new Lingo(sql);
    this.scheduler = new JobScheduler(sql, ctx);
  }

  progress(): Progress {
    return this._progress;
  }

  lingo(): Lingo {
    return this._lingo;
  }

  async alarm(): Promise<void> {
    await this.scheduler.processAlarm(this);
  }

  scheduled(job: ScheduledJob): void {
    switch (job.task) {
      default: {
        console.warn(`Unknown scheduled task: ${job.task}`);
      }
    }
  }
}
