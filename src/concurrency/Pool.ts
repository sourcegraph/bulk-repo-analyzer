import pLimit from 'p-limit';
import { PoolOptions } from '../types.js';

export async function runWithPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  options: PoolOptions
): Promise<R[]> {
  const limit = pLimit(options.concurrency);
  
  const promises = items.map(item => 
    limit(() => worker(item))
  );
  
  return Promise.all(promises);
}

export async function runWithPoolEach<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  options: PoolOptions,
  onResult: (result: R) => Promise<void> | void
): Promise<void> {
  const limit = pLimit(options.concurrency);

  const promises = items.map(item =>
    limit(async () => {
      const result = await worker(item);
      await onResult(result);
    })
  );

  await Promise.all(promises);
}
