import express from "express";
import morgan from "morgan";
import recordRoutes from "./routes/recordRoutes.js";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
const swaggerDocument = YAML.load('./swagger.yaml');

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: './downloads/' });
app.post('/records/upload-pdf', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
  
  // 확장자를 .pdf로 변경
  const newPath = req.file.path + '.pdf';
  fs.renameSync(req.file.path, newPath);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${req.file.originalname}"`);
  res.setHeader('Content-Length', req.file.size);
  fs.createReadStream(newPath).pipe(res);
});
app.timeout = 300000;
app.use(cors());

app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/records", recordRoutes);
app.use(express.static(path.join(__dirname, '../public')));
export default app;