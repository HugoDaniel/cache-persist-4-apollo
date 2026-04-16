# cache-persist-4-apollo

Cache persistence for **Apollo Client 4+**.

The original `apollo3-cache-persist` is stuck on Apollo Client 3. This package
is a from-scratch rewrite that targets the Apollo Client 4 API so you can adopt
the latest features (new `InMemoryCache` generics, updated `cache.modify`
signature, relaxed peer-dep range) without downgrading or patching your
persistence layer.

## Install

```bash
npm install cache-persist-4-apollo
```

Peer dependencies: `@apollo/client ^4.0.0` and `graphql ^16.0.0`.

## Quick start

```ts
import { InMemoryCache, ApolloClient } from "@apollo/client";
import { persistCache, LocalStorageWrapper } from "cache-persist-4-apollo";

const cache = new InMemoryCache();

// Restores the cache from storage, then persists on every cache write.
const persistor = await persistCache({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
});

const client = new ApolloClient({ cache, uri: "/graphql" });
```

That's it. `persistCache` restores any previously-saved data and returns a
`CachePersistor` you can use to pause, resume, or purge later.

## API

### `persistCache(options): Promise<CachePersistor>`

One-liner that creates a `CachePersistor`, calls `restore()`, and returns it.

### `new CachePersistor(options)`

Full control when you need it.

```ts
import { CachePersistor, LocalStorageWrapper } from "cache-persist-4-apollo";

const persistor = new CachePersistor({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
});

await persistor.restore();   // hydrate the cache from storage
await persistor.persist();   // manually trigger a persist
await persistor.purge();     // wipe stored data
persistor.pause();           // stop automatic persistence
persistor.resume();          // re-enable it
persistor.remove();          // detach from the cache entirely
const bytes = await persistor.getSize();
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `cache` | `ApolloCache` | *required* | Your Apollo `InMemoryCache` instance |
| `storage` | `PersistentStorage` | *required* | Any object with `getItem`, `setItem`, `removeItem` |
| `trigger` | `"write" \| TriggerFunction \| false` | `"write"` | When to persist. `"write"` hooks into every cache mutation |
| `debounce` | `number` | `1000` | Milliseconds to debounce writes. `0` = immediate |
| `key` | `string` | `"apollo-cache-persist"` | Storage key |
| `maxSize` | `number \| false` | `false` | Max serialized bytes. Exceeding it purges storage and pauses |
| `persistenceMapper` | `(data: string) => Promise<string>` | -- | Transform data before writing (e.g. strip `__typename`) |
| `version` | `string \| number` | -- | Stamp persisted data; mismatched versions auto-purge on restore |
| `onError` | `(error: unknown) => void` | -- | Called when a debounced persist fails |
| `debug` | `boolean` | `false` | *Reserved for future use* |

## Storage wrappers

Two built-in wrappers for the Web Storage API. Both run a write-probe in
the constructor and throw early if storage is unavailable (private browsing,
disabled, sandboxed).

```ts
import { LocalStorageWrapper, SessionStorageWrapper } from "cache-persist-4-apollo";
```

Any object matching the `PersistentStorage` interface works -- including async
implementations for IndexedDB, React Native AsyncStorage, Capacitor Preferences,
etc:

```ts
interface PersistentStorage<T = string> {
  getItem(key: string): T | null | Promise<T | null>;
  setItem(key: string, value: T): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
```

## Error handling

All error classes are exported so you can match on them:

```ts
import {
  CacheCorruptionError,
  MaxSizeExceededError,
  StorageQuotaError,
} from "cache-persist-4-apollo";
```

| Error | When |
|---|---|
| `CacheCorruptionError` | Stored data can't be parsed or restored into the cache |
| `MaxSizeExceededError` | Serialized size exceeds `maxSize` -- storage is purged and persistence pauses |
| `StorageQuotaError` | The underlying storage throws `QuotaExceededError` |

Use the `onError` option to observe errors from automatic (debounced) persists:

```ts
const persistor = await persistCache({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
  onError: (err) => console.warn("persist failed", err),
});
```

## Versioning stored data

When your schema changes you probably don't want stale cached data. Pass a
`version` and the library wraps your data in an envelope. On restore, if the
stored version doesn't match, the cache is purged and starts fresh:

```ts
const persistor = await persistCache({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
  version: 2,
});
```

## Concurrency

Persist and restore calls are serialized through an internal write chain. You
can fire `persist()` from rapid cache writes without worrying about interleaving
or lost updates.

## License

CC0 1.0 -- Public Domain. See [LICENSE](./LICENSE).
