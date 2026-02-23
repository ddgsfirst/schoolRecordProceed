import express from "express";
import morgan from "morgan";
import recordRoutes from "./routes/recordRoutes.js";

const app = express();
 
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/records", recordRoutes);

export default app;