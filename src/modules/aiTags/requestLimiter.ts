export class RequestLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];
  private startTimes: number[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly maxConcurrency: number,
    private readonly requestsPerSecond: number,
  ) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        this.activeCount += 1;
        this.recordStart();

        void Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            this.activeCount -= 1;
            this.flush();
          });
      });

      this.flush();
    });
  }

  private flush() {
    this.clearTimer();
    this.pruneStartTimes();

    while (this.queue.length && this.activeCount < this.maxConcurrency) {
      if (!this.canStartRequest()) {
        this.scheduleNextFlush();
        return;
      }

      const runTask = this.queue.shift();
      runTask?.();
    }

    if (this.queue.length && this.activeCount < this.maxConcurrency) {
      this.scheduleNextFlush();
    }
  }

  private canStartRequest() {
    return this.startTimes.length < this.requestsPerSecond;
  }

  private recordStart() {
    this.startTimes.push(Date.now());
  }

  private pruneStartTimes() {
    const now = Date.now();
    this.startTimes = this.startTimes.filter((time) => now - time < 1000);
  }

  private scheduleNextFlush() {
    if (this.timer || !this.startTimes.length) {
      return;
    }

    const now = Date.now();
    const oldestTime = this.startTimes[0];
    const waitMs = Math.max(1, 1000 - (now - oldestTime));

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, waitMs);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
