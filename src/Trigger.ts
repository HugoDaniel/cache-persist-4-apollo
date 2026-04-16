import type { ApolloCache } from "@apollo/client";
import type { Persistor } from "./Persistor.js";
import type { CachePersistorOptions, TriggerUninstallFunction } from "./types.js";
import { onCacheWrite } from "./onCacheWrite.js";

export class Trigger {
  public static readonly DEFAULT_DEBOUNCE = 1000;

  private timeout: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private uninstall: TriggerUninstallFunction | null = null;
  private readonly debounce: number;
  private readonly persistor: Persistor;
  private readonly onError: ((error: unknown) => void) | undefined;

  constructor(
    persistor: Persistor,
    cache: ApolloCache,
    options: Pick<CachePersistorOptions, "trigger" | "debounce" | "onError">,
  ) {
    this.persistor = persistor;
    this.onError = options.onError;
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
      this.persistor.persist().catch(this.handleError);
      return;
    }

    this.timeout = setTimeout(() => {
      this.persistor.persist().catch(this.handleError);
      this.timeout = null;
    }, this.debounce);
  };

  // Debounced persistence errors are silently dropped by design.
  // When onError is provided, surface them for observability.
  private handleError = (error: unknown): void => {
    if (this.onError) {
      try {
        this.onError(error);
      } catch {
        // onError itself must not throw into the void
      }
    }
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
