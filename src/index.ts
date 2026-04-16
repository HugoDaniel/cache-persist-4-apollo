export { CachePersistor } from "./CachePersistor.js";
export { persistCache } from "./persistCache.js";
export {
  CacheCorruptionError,
  MaxSizeExceededError,
  StorageQuotaError,
} from "./errors.js";
export type {
  CachePersistorOptions,
  PersistentStorage,
  TriggerFunction,
  TriggerUninstallFunction,
  PersistenceMapperFunction,
} from "./types.js";
export { LocalStorageWrapper } from "./storageWrappers/LocalStorageWrapper.js";
export { SessionStorageWrapper } from "./storageWrappers/SessionStorageWrapper.js";
