import { createClient, type RedisClientType } from "redis";

const globalForRedis = globalThis as unknown as {
  redis?: Promise<RedisClientType>;
};

export function getRedis(): Promise<RedisClientType> {
  globalForRedis.redis ??= createClient({ url: process.env.REDIS_URL })
    .on("error", (err) => console.error("Redis error", err))
    .connect() as Promise<RedisClientType>;
  return globalForRedis.redis;
}
