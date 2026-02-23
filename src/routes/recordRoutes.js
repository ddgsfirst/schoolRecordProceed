import express from "express";
import { tempViewIngest } from "../controllers/recordController.js";

const router = express.Router();

// 임시주소 + 6자리 열람번호로 문서 열람 시도(수집 작업 시작)
router.post("/temp-view", tempViewIngest);

export default router;