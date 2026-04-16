export class CacheCorruptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CacheCorruptionError";
  }
}
