export class CacheCorruptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CacheCorruptionError";
  }
}

export class StorageQuotaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageQuotaError";
  }
}

export class MaxSizeExceededError extends Error {
  public readonly dataSize: number;
  public readonly maxSize: number;

  constructor(dataSize: number, maxSize: number) {
    super(
      `Cache data size (${dataSize}) exceeds maxSize (${maxSize}). Storage purged and persistence paused.`,
    );
    this.name = "MaxSizeExceededError";
    this.dataSize = dataSize;
    this.maxSize = maxSize;
  }
}
