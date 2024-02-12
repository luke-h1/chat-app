import dotenv from "dotenv";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyIO from "fastify-socket.io";
import Redis from "ioredis";
import closeWithGrace from "close-with-grace";
import { randomUUID } from "crypto";

dotenv.config();

const PORT = process.env.PORT || "3001";
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const CONNECTION_COUNT_KEY = "chat:connection-count";
const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated";
const NEW_MESSAGE_CHANNEL = "chat:new-message";
const MESSAGES_KEY = "chat:messages";

// function sendMessagetoRoom({
//   room,
//   messageContents,
// }: {
//   room: string;
//   messageContents: string;
// }) {
//   const channel = `chat:${room}:messages`;
// }

const { REDIS_URL } = process.env;

if (!REDIS_URL) {
  console.error("Missing `REDIS_URL`");
  process.exit(1);
}

const publisher = new Redis(REDIS_URL, {
  // tls: {
  //     rejectUnauthorized: true
  // }
});

const subscriber = new Redis(REDIS_URL, {
  // tls: {
  //     rejectUnauthorized: true
  // }
});

let connectedClients = 0;

async function buildServer() {
  const app = fastify();

  await app.register(fastifyCors, {
    origin: CORS_ORIGIN,
  });

  await app.register(fastifyIO);

  const currentCount = await publisher.get(CONNECTION_COUNT_KEY);

  if (!currentCount) {
    await publisher.set(CONNECTION_COUNT_KEY, 0);
  }

  app.io.on("connection", async (io) => {
    console.log("Client connected");
    const incResult = await publisher.incr(CONNECTION_COUNT_KEY);

    connectedClients += 1;

    await publisher.publish(
      CONNECTION_COUNT_UPDATED_CHANNEL,
      String(incResult)
    );

    io.on(NEW_MESSAGE_CHANNEL, async (payload) => {
      const { message } = payload;

      if (!message) {
        console.error("no message");
        return;
      }

      await publisher.publish(NEW_MESSAGE_CHANNEL, message.toString());
    });

    io.on("disconnect", async () => {
      console.log("Client disconnected");
      connectedClients--;
      const decrResult = await publisher.decr(CONNECTION_COUNT_KEY);

      await publisher.publish(
        CONNECTION_COUNT_UPDATED_CHANNEL,
        String(decrResult)
      );
    });
  });

  subscriber.subscribe(CONNECTION_COUNT_UPDATED_CHANNEL, (err, count) => {
    if (err) {
      console.error(
        `Error subscribing to ${CONNECTION_COUNT_UPDATED_CHANNEL}`,
        err
      );
      return;
    }
    console.log(
      `${count} client${
        (count as number) > 1 ? "s" : ""
      } subscribed to ${CONNECTION_COUNT_UPDATED_CHANNEL} channel`
    );
  });

  subscriber.subscribe(NEW_MESSAGE_CHANNEL, (err, count) => {
    if (err) {
      console.error(`Error subscribing to ${NEW_MESSAGE_CHANNEL}`);
      return;
    }

    console.log(
      `${count} clients subscribed to ${NEW_MESSAGE_CHANNEL} channel`
    );
  });

  subscriber.on("message", (channel, text) => {
    if (channel === CONNECTION_COUNT_UPDATED_CHANNEL) {
      app.io.emit(CONNECTION_COUNT_UPDATED_CHANNEL, {
        count: text,
      });
      return;
    }

    if (channel === NEW_MESSAGE_CHANNEL) {
      app.io.emit(NEW_MESSAGE_CHANNEL, {
        message: text,
        id: randomUUID(),
        createdAt: new Date(),
        port: PORT,
      });
      return;
    }
  });

  app.get("/api/healthcheck", (req, res) => {
    return {
      status: "ok",
      port: PORT,
    };
  });

  return app;
}

async function main() {
  const app = await buildServer();

  try {
    await app.listen({
      port: parseInt(PORT, 10),
      host: HOST,
    });

    closeWithGrace(
      {
        delay: 2000,
      },
      async () => {
        console.log("shutting down");
        if (connectedClients > 0) {
          const currentCount = parseInt(
            (await publisher.get(CONNECTION_COUNT_KEY)) || "0",
            10
          );

          // ensure we don't go below 0
          const newCount = Math.max(currentCount - connectedClients, 0);

          await publisher.set(CONNECTION_COUNT_KEY, newCount);
        }

        await app.close();
      }
    );

    console.log(`server started on http://${HOST}:${PORT}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
