import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "app-data.json");

const EMPTY_DATA = {
  settings: {
    dailyPenaltyRate: 0.0001,
    asOfDate: "2026-07-27",
  },
  periods: [],
  records: [],
};

await fs.writeFile(DATA_PATH, `${JSON.stringify(EMPTY_DATA, null, 2)}\n`, "utf8");
console.log(`Reset ${DATA_PATH}`);
