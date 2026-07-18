const path = require("path");
const { chromium } = require(path.join(__dirname, "../client/node_modules/@playwright/test"));

async function renderDiagram(browser, diagramName) {
  const svgPath = path.resolve(__dirname, `../docs/diagrams/${diagramName}.svg`);
  const pngPath = path.resolve(__dirname, `../docs/diagrams/${diagramName}.png`);
  const page = await browser.newPage({
    viewport: { width: 2100, height: 1700 },
    deviceScaleFactor: 1.5
  });
  await page.goto(`file:///${svgPath.replaceAll("\\", "/").replaceAll(" ", "%20")}`);
  await page.locator("svg").screenshot({ path: pngPath });
  await page.close();
  console.log(`Rendered ${pngPath}`);
}

async function render() {
  const requestedDiagrams = process.argv.slice(2);
  const diagramNames = requestedDiagrams.length
    ? requestedDiagrams
    : ["payroll-system-use-case", "payroll-workflow", "system-architecture"];
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  for (const diagramName of diagramNames) {
    await renderDiagram(browser, diagramName);
  }
  await browser.close();
}

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
