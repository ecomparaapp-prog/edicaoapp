import { createServer } from "http";
import app from "./app";
import { initWebSocket } from "./websocket";
import { ensureSchema } from "./services/ensureSchema";
import { seedTestUsers } from "./services/seedTestUsers";
import { seedFakeStores } from "./services/seedFakeStores";
import { startWeeklyResetCron } from "./services/weeklyReset";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  await ensureSchema();
  await seedTestUsers();
  await seedFakeStores();
  startWeeklyResetCron();

  const httpServer = createServer(app);
  initWebSocket(httpServer);

  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
