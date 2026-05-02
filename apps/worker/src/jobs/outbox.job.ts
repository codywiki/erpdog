import type { Job } from "bullmq";

import { prisma } from "../prisma";

export type OutboxJobData = {
  eventId: string;
};

export async function handleOutboxJob(job: Job<OutboxJobData>) {
  const event = await prisma.outboxEvent.findUnique({
    where: { id: job.data.eventId },
  });

  if (!event || event.status === "sent") {
    return { skipped: true };
  }

  await prisma.outboxEvent.update({
    where: { id: event.id },
    data: {
      status: "processing",
      lockedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    // Delivery adapters such as Feishu cards/todos plug in here.
    console.info(`[outbox] delivered ${event.topic}:${event.id}`);

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "sent",
        processedAt: new Date(),
        error: null,
      },
    });

    return { delivered: true };
  } catch (error) {
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        nextRunAt: new Date(Date.now() + 60_000),
      },
    });
    throw error;
  }
}
