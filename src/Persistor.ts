import type { CacheAdapter } from "./CacheAdapter.js";
import type { StorageAdapter } from "./StorageAdapter.js";
import type { PersistenceMapperFunction } from "./types.js";
import { CacheCorruptionError, MaxSizeExceededError } from "./errors.js";

// Intentional no-op: prevents a rejected promise from poisoning the write chain.
// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop(): void {}

export interface PersistorOptions {
  maxSize?: number | false;
  persistenceMapper?: PersistenceMapperFunction;
  debug?: boolean;
  version?: string | number;
}

export class Persistor {
  private paused = false;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly cacheAdapter: CacheAdapter;
  private readonly storageAdapter: StorageAdapter;
  private readonly options: PersistorOptions;

  constructor(
    cacheAdapter: CacheAdapter,
    storageAdapter: StorageAdapter,
    options: PersistorOptions,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!cacheAdapter) {
      throw new Error("Persistor requires a cacheAdapter");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!storageAdapter) {
      throw new Error("Persistor requires a storageAdapter");
    }
    this.cacheAdapter = cacheAdapter;
    this.storageAdapter = storageAdapter;
    this.options = options;
  }

  public persist(): Promise<void> {
    const ticket = this.writeChain.then(() => this.doPersist());
    // A failed persist must not block future ones
    this.writeChain = ticket.catch(noop);
    return ticket;
  }

  private async doPersist(): Promise<void> {
    if (this.paused) return;

    let data = this.cacheAdapter.extract();

    if (this.options.persistenceMapper) {
      data = await this.options.persistenceMapper(data);
    }

    if (this.options.version !== undefined) {
      data = JSON.stringify({ __version: this.options.version, data });
    }

    const maxSize = this.options.maxSize;
    if (maxSize !== false && maxSize !== undefined && data.length > maxSize) {
      await this.purge();
      this.paused = true;
      throw new MaxSizeExceededError(data.length, maxSize);
    }

    await this.storageAdapter.write(data);
  }

  public restore(): Promise<void> {
    const ticket = this.writeChain.then(() => this.doRestore());
    this.writeChain = ticket.catch(noop);
    return ticket;
  }

  private async doRestore(): Promise<void> {
    let data = await this.storageAdapter.read();
    if (data === null) return;

    if (this.options.version !== undefined) {
      let envelope: { __version?: unknown; data?: unknown };
      try {
        envelope = JSON.parse(data) as { __version?: unknown; data?: unknown };
      } catch (error) {
        await this.purge();
        throw new CacheCorruptionError(
          "Failed to restore cache from storage",
          { cause: error },
        );
      }
      if (envelope.__version !== this.options.version) {
        await this.purge();
        return;
      }
      if (typeof envelope.data !== "string") {
        await this.purge();
        throw new CacheCorruptionError(
          "Failed to restore cache from storage: invalid envelope",
        );
      }
      data = envelope.data;
    }

    try {
      this.cacheAdapter.restore(data);
    } catch (error) {
      await this.purge();
      throw new CacheCorruptionError(
        "Failed to restore cache from storage",
        { cause: error },
      );
    }
  }

  public async purge(): Promise<void> {
    await this.storageAdapter.purge();
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  public set isPaused(value: boolean) {
    this.paused = value;
  }
}
