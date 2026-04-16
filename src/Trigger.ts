import type { ApolloCache } from "@apollo/client";
import type { Persistor } from "./Persistor.js";
import type { CachePersistorOptions, TriggerUninstallFunction } from "./types.js";
import { onCacheWrite } from "./onCacheWrite.js";

// Intentional no-op for .catch() on fire-and-forget persist calls.
// Debounced persistence errors are silently dropped by design.
// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop(): void {}


export class Trigger {
  public static readonly DEFAULT_DEBOUNCE = 1000;

  private timeout: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private uninstall: TriggerUninstallFunction | null = null;
  private readonly debounce: number;
  private readonly persistor: Persistor;

  constructor(
    persistor: Persistor,
    cache: ApolloCache,
    options: Pick<CachePersistorOptions, "trigger" | "debounce">,
  ) {
    this.persistor = persistor;
    const { trigger = "write", debounce } = options;
    this.debounce = debounce ?? Trigger.DEFAULT_DEBOUNCE;

    if (trigger === false) return;

    if (trigger === "write") {
      this.uninstall = onCacheWrite(cache, this.fire);
    } else if (typeof trigger === "function") {
      this.uninstall = trigger(this.fire);
    }
  }

  public fire = (): void => {
    if (this.paused) return;

    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }

    if (this.debounce <= 0) {
      this.persistor.persist().catch(noop);
      return;
    }

    this.timeout = setTimeout(() => {
      this.persistor.persist().catch(noop);
      this.timeout = null;
    }, this.debounce);
  };

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public remove(): void {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.uninstall) {
      this.uninstall();
      this.uninstall = null;
    }
    this.paused = true;
  }
}
