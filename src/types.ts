import type { ApolloCache } from "@apollo/client";

export type TriggerUninstallFunction = () => void;

export type TriggerFunction = (
  persist: () => void,
) => TriggerUninstallFunction;

export type PersistenceMapperFunction = (data: string) => Promise<string>;

export interface PersistentStorage<T = string> {
  getItem(key: string): T | null | Promise<T | null>;
  setItem(key: string, value: T): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface CachePersistorOptions {
  cache: ApolloCache;
  storage: PersistentStorage;
  trigger?: "write" | TriggerFunction | false;
  debounce?: number;
  key?: string;
  maxSize?: number | false;
  persistenceMapper?: PersistenceMapperFunction;
  debug?: boolean;
}
