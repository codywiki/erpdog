import { Worker } from "bullmq";
import IORedis from "ioredis";

import { parseServerEnv } from "@erpdog/config";

import { handleBillingJob } from "./jobs/billing.job";
import { handleOutboxJob } from "./jobs/outbox.job";
import { prisma } from "./prisma";

const env = parseServerEnv(process.env);
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const workers = [
  new Worker("billing", handleBillingJob, {
    connection,
    concurrency: 1
  }),
  new Worker("outbox", handleOutboxJob, {
    connection,
    concurrency: 5
  })
];

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.info(`[worker] completed ${job.queueName}:${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] failed ${job?.queueName}:${job?.id}`, error);
  });
}

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  await connection.quit();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.info("[worker] erpdog worker started");
