// scripts/exportAbis.js
import fs from "fs";
import path from "path";
import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const outDir = path.join(process.cwd(), "frontend", "src", "abis");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const contracts = ["MarketFactory", "PredictionMarket", "PythAdapter"];
  for (const name of contracts) {
    try {
      const artifact = await hre.artifacts.readArtifact(name);
      const outPath = path.join(outDir, `${name}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ abi: artifact.abi, bytecode: artifact.bytecode }, null, 2));
      console.log("Wrote", outPath);
    } catch (e) {
      console.warn("Skipping", name, "artifact not found");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
