// scripts/inspect.js
import hre from "hardhat";
import dotenv from "dotenv";
import { ethers as ethersLib } from "ethers";
dotenv.config();

async function main() {
  const rpc = process.env.RPC || "http://127.0.0.1:8545";
  const provider = new ethersLib.providers.JsonRpcProvider(rpc);

  let signer;
  if (process.env.DEPLOYER_KEY && process.env.DEPLOYER_KEY !== "") {
    signer = new ethersLib.Wallet(process.env.DEPLOYER_KEY, provider);
    console.log("Using DEPLOYER_KEY:", signer.address);
  } else {
    signer = provider.getSigner();
    console.log("Using provider signer");
  }

  const factoryAddr = process.env.FACTORY_ADDRESS || "0x09941AEe3ca705259498fb6dDBA0669B5002656a";
  const artifact = await hre.artifacts.readArtifact("MarketFactory");
  const factory = new ethersLib.Contract(factoryAddr, artifact.abi, signer);

  const markets = await factory.getMarkets();
  console.log("Markets:", markets);
  if (markets.length) console.log("Last market:", markets[markets.length - 1]);
}

main().catch((e) => { console.error(e); process.exit(1); });
