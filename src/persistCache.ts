import type { CachePersistorOptions } from "./types.js";
import { CachePersistor } from "./CachePersistor.js";

export async function persistCache(
  options: CachePersistorOptions,
): Promise<CachePersistor> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
  if (!options) {
    throw new Error("persistCache requires an options object");
  }
  const persistor = new CachePersistor(options);
  await persistor.restore();
  return persistor;
}
