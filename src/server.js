import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT || 3000);

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection:", err);
});

const server = app.listen(port, () => {
  console.log(`Server running on :http://localhost:${port}`);
});
server.timeout = 300000;
server.on("error", (err) => {
  console.error("server error:", err);
});