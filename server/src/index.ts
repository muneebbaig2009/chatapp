import { createServer } from "http";
import { createApp } from "./app.js";
import { initSockets } from "./sockets/index.js";
import { env } from "./config/env.js";

const app = createApp();
const httpServer = createServer(app);
initSockets(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
