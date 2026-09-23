// Startup file for hosting panels whose Node.js loader expects CommonJS
// (for example cPanel "Setup Node.js App" / Phusion Passenger).
// It loads the real ES-module server IN THIS SAME PROCESS, so Passenger's
// listen() hook keeps working. Do not replace this with a child process.
import("./server/index.mjs").catch((error) => {
  console.error(error);
  process.exit(1);
});
