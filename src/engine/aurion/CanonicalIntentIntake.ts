import type { ServerCanonicalIntent } from "./ServerCanonicalIntent";

export class CanonicalIntentIntake {
  private readonly queue: ServerCanonicalIntent[] = [];
  private readonly history: ServerCanonicalIntent[] = [];
  private readonly maxHistory = 1000;

  record(intent: ServerCanonicalIntent): void {
    this.queue.push(intent);
    this.history.push(intent);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  drain(): ServerCanonicalIntent[] {
    return this.queue.splice(0, this.queue.length);
  }

  peek(): readonly ServerCanonicalIntent[] {
    return this.queue;
  }

  getHistory(): readonly ServerCanonicalIntent[] {
    return this.history;
  }

  clear(): void {
    this.queue.length = 0;
    this.history.length = 0;
  }
}

export const canonicalIntentIntake = new CanonicalIntentIntake();
