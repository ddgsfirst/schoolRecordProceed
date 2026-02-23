console.log("recordController loaded - NEW VERSION");
import { isValidTempUrl, isValidViewCode } from "../utils/validate.js";
import { fetchRecordFromTempView } from "../services/recordService.js";
import fs from 'fs';
import path from 'path';

export async function tempViewIngest(req, res) {
  console.log("tempViewIngest called", req.body);
  const { tempUrl, viewCode } = req.body || {};

  if (!isValidTempUrl(tempUrl)) {
    return res.status(400).json({ message: "tempUrl 형식이 올바르지 않습니다." });
  }
  if (!isValidViewCode(viewCode)) {
    return res.status(400).json({ message: "viewCode는 6자리 숫자여야 합니다." });
  }

  // ✅ 타임아웃 방지: Express 소켓 타임아웃 늘리기
  req.socket.setTimeout(300000); // 5분

  try {
    const result = await fetchRecordFromTempView({
      tempUrl: tempUrl.trim(),
      viewCode: String(viewCode).trim(),
    });

    const absPath = path.resolve(result.path);
    const filename = path.basename(absPath);
    const stat = fs.statSync(absPath);

    console.log('PDF 경로:', absPath);
    console.log('파일 크기:', stat.size);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);
    
    const stream = fs.createReadStream(absPath);
    stream.on('error', (e) => {
      console.error('스트림 에러:', e);
      res.status(500).json({ ok: false, message: "파일 스트림 에러" });
    });
    stream.pipe(res);

  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: e?.message || "수집 실패",
    });
  }
}