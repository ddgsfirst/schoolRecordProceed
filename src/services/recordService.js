import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import "dotenv/config";

export async function fetchRecordFromTempView({ tempUrl, viewCode }) {
  const downloadDir = process.env.DOWNLOAD_DIR || "./downloads";
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const stamp = () => String(Date.now());

  async function saveDebug(tag, err, p = page) {
    try {
      await p.screenshot({
        path: path.join(downloadDir, `debug_${tag}_${stamp()}.png`),
        fullPage: true,
      });
    } catch {}
    try {
      fs.writeFileSync(
        path.join(downloadDir, `debug_${tag}_${stamp()}.html`),
        await p.content(),
        "utf8"
      );
    } catch {}
    if (err) {
      try {
        fs.writeFileSync(
          path.join(downloadDir, `debug_${tag}_${stamp()}.log.txt`),
          String(err?.stack || err?.message || err),
          "utf8"
        );
      } catch {}
    }
  }

  async function isAlreadyUsed(p) {
    return await p
      .locator('text=이미 열람한 주소입니다')
      .first()
      .isVisible()
      .catch(() => false);
  }

  async function clickViewAnywhere(p) {
    const selectors = [
      'a:has-text("열람")',
      'button:has-text("열람")',
      'a:has-text("보기")',
      'button:has-text("보기")',
      '[role="button"]:has-text("열람")',
      '[role="link"]:has-text("열람")',
      'input[type="button"][value*="열람"]',
      'input[type="submit"][value*="열람"]',
      'table a:has-text("열람"), table button:has-text("열람")',
    ];

    for (const sel of selectors) {
      const loc = p.locator(sel).first();
      if ((await loc.count()) > 0) {
        try {
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await loc.click({ timeout: 3000 });
          return true;
        } catch {}
      }
    }
    return false;
  }

  // ---- 설정(톱니) -> 페이지 전환(첫번째) : "좌상단 톱니"는 DOM이 난해해서 좌표 클릭이 가장 안정적
  async function setPagingModeByUI(docPage) {
    // 1) 톱니(좌상단) 클릭
    await docPage.mouse.click(25, 25);
    await docPage.waitForTimeout(300);

    // 2) '페이지 전환' 탭 클릭
    const tab = docPage.locator('text=페이지 전환').first();
    if ((await tab.count()) > 0) {
      await tab.click({ timeout: 2000 }).catch(() => {});
    } else {
      const alt = docPage.locator('text=페이지전환').first();
      if ((await alt.count()) > 0) {
        await alt.click({ timeout: 2000 }).catch(() => {});
      }
    }
    await docPage.waitForTimeout(250);

    // 3) 첫번째 옵션 클릭 (라디오가 있으면 그걸 우선)
    const radio = docPage.locator('input[type="radio"]').first();
    if ((await radio.count()) > 0) {
      await radio.check({ timeout: 2000 }).catch(async () => {
        await radio.click({ timeout: 2000 }).catch(() => {});
      });
    } else {
      const opt = docPage.locator("button, label, [role='option']").first();
      if ((await opt.count()) > 0) {
        await opt.click({ timeout: 2000 }).catch(() => {});
      }
    }

    await docPage.waitForTimeout(300);

    // 4) 설정 패널 닫기
    await docPage.keyboard.press("Escape").catch(() => {});
    await docPage.waitForTimeout(250);
  }

  // ✅ "자동" -> "페이지맞춤" (option value="page-fit") 을 selectOption으로 확실히 적용
async function setFitToPageByUI(docPage) {
  // 오버레이 떠 있으면 방해되니 한번 닫고 시작
  await docPage.keyboard.press("Escape").catch(() => {});
  await docPage.waitForTimeout(120);

  // 1) 먼저: select에 option[value="page-fit"]가 있으면 그걸로 끝 (가장 안정)
  const selectWithPageFit = docPage.locator('select:has(option[value="page-fit"])').first();
  if ((await selectWithPageFit.count().catch(() => 0)) > 0) {
    try {
      await selectWithPageFit.selectOption({ value: "page-fit" });
      await docPage.waitForTimeout(200);
      return true;
    } catch {}
  }

  // 2) value를 모르더라도 label로 선택 시도 ("페이지맞춤")
  const anySelect = docPage.locator("select").first();
  if ((await anySelect.count().catch(() => 0)) > 0) {
    try {
      await anySelect.selectOption({ label: "페이지맞춤" });
      await docPage.waitForTimeout(200);
      return true;
    } catch {}
  }

  // 3) fallback: 화면 드롭다운(자동/%) 눌러서 메뉴 열고 "페이지맞춤" 클릭 (select가 없을 때)
  const autoText = docPage.locator("text=자동").first();
  let opened = false;

  if ((await autoText.count().catch(() => 0)) > 0) {
    await autoText.click({ timeout: 1500 }).catch(() => {});
    opened = true;
  }

  if (!opened) {
    const percent = docPage.locator("text=/\\d+%/").first();
    if ((await percent.count().catch(() => 0)) > 0) {
      await percent.click({ timeout: 1500 }).catch(() => {});
      opened = true;
    }
  }

  if (!opened) {
    // 손모양 옆 드롭다운 자리 대충 클릭
    await docPage.mouse.click(160, 25);
  }

  await docPage.waitForTimeout(150);

  // 메뉴 아이템이 진짜 버튼/리스트로 뜨는 케이스
  const fitItem = docPage.locator('text=페이지맞춤').first();
  if ((await fitItem.count().catch(() => 0)) > 0) {
    await fitItem.click({ timeout: 2000 }).catch(() => {});
  }

  await docPage.waitForTimeout(150);
  await docPage.keyboard.press("Escape").catch(() => {});
  return true;
}

  // "1 / 12" 같은 텍스트를 화면에서 찾아 총 페이지 읽기
  async function readTotalPages(docPage) {
    return await docPage.evaluate(() => {
      const re = /(\d+)\s*\/\s*(\d+)/;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = (node.nodeValue || "").trim();
        const m = t.match(re);
        if (m) return { cur: Number(m[1]), total: Number(m[2]) };
      }
      return null;
    });
  }

  // 페이지 표시(cur/total)가 바뀔 때까지 기다리기
  async function waitPageNumberChange(docPage, prevCur, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const info = await readTotalPages(docPage);
      if (info && info.cur !== prevCur) return info;
      await docPage.waitForTimeout(200);
    }
    return null;
  }

  // 다음 페이지(>) 클릭
  async function clickNext(docPage) {
    const selectors = [
      'button[aria-label*="다음"]',
      'button[title*="다음"]',
      'button:has-text("›")',
      'button:has-text(">")',
      'button:has-text("▶")',
      'a:has-text(">")',
    ];

    for (const sel of selectors) {
      const loc = docPage.locator(sel).first();
      if ((await loc.count()) > 0) {
        try {
          await loc.click({ timeout: 1500 });
          return true;
        } catch {}
      }
    }

    // fallback: 키보드
    try {
      await docPage.keyboard.press("ArrowRight");
      return true;
    } catch {}
    return false;
  }

  // 문서 렌더 요소(canvas/img) 중 “문서처럼 보이는 것”을 고름
  async function pickBestDocElementHandle(docPage) {
    return await docPage.evaluateHandle(() => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      const candidates = [
        ...Array.from(document.querySelectorAll("canvas")),
        ...Array.from(document.querySelectorAll("img")),
      ];

      function score(el) {
        const r = el.getBoundingClientRect();
        const w = r.width,
          h = r.height;
        if (w < 300 || h < 400) return -1; // 너무 작으면 제외
        if (r.top < 40 && r.left < 80) return -1; // 좌상단 아이콘류 제외
        if (r.bottom > viewportH - 20 && r.height < 200) return -1; // 하단바 같은 얕은 요소 제외

        const area = w * h;

        // 중앙에 가까울수록 가산
        const cx = r.left + w / 2;
        const cy = r.top + h / 2;
        const dist = Math.hypot(cx - viewportW / 2, cy - viewportH / 2);
        const centerBonus = Math.max(0, 1 - dist / Math.hypot(viewportW, viewportH));

        // 문서 비율(A4: 595/842 ≈ 0.707) 근처 가산
        const ratio = w / h;
        const ratioBonus = Math.max(0, 1 - Math.abs(ratio - 0.707) * 2);

        return area * (0.7 + 0.2 * centerBonus + 0.1 * ratioBonus);
      }

      let best = null;
      let bestScore = -1;
      for (const el of candidates) {
        const s = score(el);
        if (s > bestScore) {
          bestScore = s;
          best = el;
        }
      }
      return best || document.body;
    });
  }

  async function shotDocOnly(docPage, outPath) {
    // ✅ 혹시 메뉴/설정 패널이 떠있으면 찍히니까 닫기
    await docPage.keyboard.press("Escape").catch(() => {});
    await docPage.waitForTimeout(120);

    const handle = await pickBestDocElementHandle(docPage);
    try {
      const el = handle.asElement();
      if (el) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.screenshot({ path: outPath });
        return;
      }
    } catch {}

    // fallback
    await docPage.screenshot({ path: outPath, fullPage: false });
  }

  // ✅ 비율 문제 방지: A4에 억지로 끼우지 말고, "캡처 이미지 크기 그대로" PDF 페이지를 만든다
  async function buildPdfFromPngs(pngPaths, outPdfPath) {
    const pdfDoc = await PDFDocument.create();

    for (const pngPath of pngPaths) {
      const buf = fs.readFileSync(pngPath);
      const img = await pdfDoc.embedPng(buf);

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    fs.writeFileSync(outPdfPath, await pdfDoc.save());
  }

  async function waitViewerReady(docPage) {
    await docPage.waitForTimeout(800);
    await docPage.waitForLoadState("networkidle").catch(() => {});
    await docPage.waitForTimeout(400);
  }

  try {
    await page.goto(tempUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 비밀번호 입력 화면
    const pinInput = page.locator("#pinNo");
    const confirmBtn = page.locator(".confirmBtn");

    await pinInput.waitFor({ state: "visible", timeout: 15000 });
    await pinInput.fill("");
    await pinInput.type(String(viewCode), { delay: 30 });

    await confirmBtn.waitFor({ state: "visible", timeout: 15000 });
    const navWait = page.waitForNavigation({ timeout: 30000 }).catch(() => null);
    await confirmBtn.click();
    await navWait;
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    if (await isAlreadyUsed(page)) {
      await saveDebug("already_used", null, page);
      throw new Error("이미 열람한 주소입니다(1회 열람 링크 소진). 새 임시주소로 다시 시도해야 합니다.");
    }

    // 열람/보기 클릭 → 팝업일 수도
    const popupWait = page.waitForEvent("popup", { timeout: 12000 }).catch(() => null);
    await clickViewAnywhere(page);
    const popup = await popupWait;

    const docPage = popup || page;
    await docPage.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
    await docPage.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitViewerReady(docPage);

    if (await isAlreadyUsed(docPage)) {
      await saveDebug("already_used_doc", null, docPage);
      throw new Error("이미 열람한 주소입니다(1회 열람 링크 소진). 새 임시주소로 다시 시도해야 합니다.");
    }

    // ✅ 1) 페이지 전환 모드로 변경 (너 영상 흐름)
    await setPagingModeByUI(docPage);
    await waitViewerReady(docPage);

    // ✅ 2) "자동" -> "페이지맞춤" 으로 변경 후 캡처 시작
    await setFitToPageByUI(docPage);
    await waitViewerReady(docPage);

    // total 페이지 읽기(없으면 12로)
    const firstInfo = await readTotalPages(docPage);
    const totalPages = Math.min(Math.max(firstInfo?.total || 12, 1), 60);

    const shots = [];
    let curInfo = firstInfo || { cur: 1, total: totalPages };

    for (let i = 1; i <= totalPages; i++) {
      // 혹시 페이지 넘기면서 줌이 풀리면 다시 맞춤 걸어줌(안전)
      if (i === 1 || i % 5 === 0) {
        await setFitToPageByUI(docPage).catch(() => {});
        await docPage.waitForTimeout(200);
      }

      const pngPath = path.join(downloadDir, `record_page_${stamp()}_${String(i).padStart(2, "0")}.png`);

      // 문서만 캡처
      await shotDocOnly(docPage, pngPath);
      shots.push(pngPath);

      if (i === totalPages) break;

      // 다음 페이지 이동
      const ok = await clickNext(docPage);
      if (!ok) {
        await saveDebug("next_failed", null, docPage);
        break;
      }

      // 페이지 번호 바뀔 때까지 대기
      const changed = await waitPageNumberChange(docPage, curInfo.cur, 9000);
      if (changed) curInfo = changed;

      await waitViewerReady(docPage);
    }

    // PDF 합치기
    const outPdf = path.join(downloadDir, `student_record_pages_${Date.now()}.pdf`);
    await buildPdfFromPngs(shots, outPdf);

    return {
      ok: true,
      type: "CAPTURED_PAGES_PDF",
      path: outPdf,
      sourceUrl: tempUrl,
      pagesCaptured: shots.length,
      note: "페이지 전환 모드 + '페이지맞춤' 적용 후, 페이지별 캡처로 PDF 생성",
    };
  } catch (e) {
    await saveDebug("fatal", e, page);
    throw e;
  } finally {
    await browser.close();
  }
}