import express from "express";
import morgan from "morgan";
import recordRoutes from "./routes/recordRoutes.js";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.timeout = 300000;
app.use(cors());

app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/records", recordRoutes);
app.use(express.static(path.join(__dirname, '../public')));
export default app;