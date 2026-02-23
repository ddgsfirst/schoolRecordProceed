console.log("recordController loaded - NEW VERSION");
import { isValidTempUrl, isValidViewCode } from "../utils/validate.js";
import { fetchRecordFromTempView } from "../services/recordService.js";

export async function tempViewIngest(req, res) {
  console.log("tempViewIngest called", req.body);
  const { tempUrl, viewCode } = req.body || {};

  if (!isValidTempUrl(tempUrl)) {
    return res.status(400).json({ message: "tempUrl 형식이 올바르지 않습니다." });
  }
  if (!isValidViewCode(viewCode)) {
    return res.status(400).json({ message: "viewCode는 6자리 숫자여야 합니다." });
  }

  try {
    const cleanedUrl = tempUrl.trim();           // URL만
    const cleanedCode = String(viewCode).trim(); // 6자리만

    const result = await fetchRecordFromTempView({
      tempUrl: cleanedUrl,
      viewCode: cleanedCode,
    });
    console.log("recordController loaded - NEW VERSION");
    return res.json({
      ok: true,
      fileType: result.type,
      savedPath: result.path,
      sourceUrl: result.sourceUrl,
    });
    
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: e?.message || "수집 실패",
    });
  }
  
}