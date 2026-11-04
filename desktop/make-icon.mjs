// Render the existing Borderless SVG into macOS source artwork. No remote assets.
import { chromium } from "playwright";
import { mkdtemp, mkdir, readFile, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("Regenerate the ICNS artwork on macOS with iconutil.");
const directory = fileURLToPath(new URL("./assets/", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "borderless-icon-"));
const iconset = join(temporary, "Borderless.iconset");
let browser;
try {
  await mkdir(iconset);
  await mkdir(directory, { recursive: true });
  const svg = await readFile(new URL("../public/assets/icon.svg", import.meta.url), "utf8");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`);
  const source = join(temporary, "source.png");
  await page.screenshot({ path: source, omitBackground: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      execFileSync("/usr/bin/sips", ["-z", String(size * scale), String(size * scale), source, "--out", join(iconset, `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`)], { stdio: "ignore" });
    }
  }
  execFileSync("/usr/bin/iconutil", ["-c", "icns", iconset, "-o", join(directory, "icon.icns")]);
  await copyFile(join(iconset, "icon_512x512.png"), join(directory, "icon.png"));
  console.log("Rendered desktop/assets/icon.icns and icon.png from public/assets/icon.svg.");
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}
