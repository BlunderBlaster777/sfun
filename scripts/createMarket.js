// scripts/createMarket.js
import hre from "hardhat";
import dotenv from "dotenv";
import { ethers as ethersLib } from "ethers";
dotenv.config();

function decodeRevert(data) {
  try {
    if (!data) return null;
    // strip 0x
    const hex = data.startsWith("0x") ? data.slice(2) : data;
    // standard revert reason is: 0x08c379a0 + offset + length + utf8 bytes
    if (hex.startsWith("08c379a0")) {
      const bytes = "0x" + hex.slice(8 + 64); // skip selector + offset + length words
      return ethersLib.utils.toUtf8String(bytes);
    }
    // fallback: try to decode as utf8
    return ethersLib.utils.toUtf8String("0x" + hex);
  } catch (e) {
    return null;
  }
}

async function main() {
  const rpcUrl = process.env.RPC || "http://127.0.0.1:8545";
  const provider = new ethersLib.providers.JsonRpcProvider(rpcUrl);

  // signer selection
  let signer;
  if (process.env.DEPLOYER_KEY && process.env.DEPLOYER_KEY !== "") {
    signer = new ethersLib.Wallet(process.env.DEPLOYER_KEY, provider);
    console.log("Using DEPLOYER_KEY:", signer.address);
  } else {
    signer = provider.getSigner();
    try {
      const addr = await signer.getAddress();
      console.log("Using unlocked signer:", addr);
    } catch (e) {
      console.error("No DEPLOYER_KEY and provider signer unavailable. Set DEPLOYER_KEY or run a local node.");
      process.exit(1);
    }
  }

  // validate factory address
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress || !ethersLib.utils.isAddress(factoryAddress)) {
    console.error("FACTORY_ADDRESS missing or invalid in .env:", factoryAddress);
    process.exit(1);
  }

  // market params
  const strike = process.env.STRIKE || "300000000000";
  const startTime = Math.floor(Date.now() / 1000) + 60;
  const endTime = startTime + (process.env.DURATION_SECONDS ? Number(process.env.DURATION_SECONDS) : 3600);
  const minBet = ethersLib.utils.parseEther(process.env.MIN_BET || "0.01");
  const priceId = process.env.PRICE_ID || "0x0000000000000000000000000000000000000000000000000000000000000000";

  // check signer balance
  const signerAddress = await signer.getAddress();
  const balance = await provider.getBalance(signerAddress);
  console.log("Deployer balance:", ethersLib.utils.formatEther(balance), "ETH");
  if (balance.lt(minBet)) {
    console.error("Deployer balance is less than minBet. Fund the deployer account and retry.");
    process.exit(1);
  }

  // load artifact and create contract instance
  const artifact = await hre.artifacts.readArtifact("MarketFactory");
  const factory = new ethersLib.Contract(factoryAddress, artifact.abi, signer);

  console.log("Calling createMarket with:");
  console.log({ strike, startTime, endTime, minBet: minBet.toString(), priceId });

  // estimate gas and send tx
  let tx;
  try {
    const gasEstimate = await factory.estimateGas.createMarket(strike, startTime, endTime, minBet, priceId);
    const gasLimit = gasEstimate.mul(ethersLib.BigNumber.from(12)).div(10); // +20% buffer
    tx = await factory.createMarket(strike, startTime, endTime, minBet, priceId, { gasLimit });
  } catch (err) {
    // try to decode revert reason if available
    const data = err?.error?.data || err?.data || err?.transaction?.data || err?.error?.transaction?.data;
    const reason = decodeRevert(data);
    console.error("Failed to send createMarket transaction. Revert reason:", reason || err.message || err);
    process.exit(1);
  }

  let receipt;
  try {
    receipt = await tx.wait();
    console.log("createMarket tx:", receipt.transactionHash);
  } catch (err) {
    const data = err?.error?.data || err?.data || err?.transaction?.data || err?.error?.transaction?.data;
    const reason = decodeRevert(data);
    console.error("Transaction reverted or failed. Revert reason:", reason || err.message || err);
    process.exit(1);
  }

  // print markets
  try {
    const markets = await factory.getMarkets();
    console.log("Markets:", markets);
    if (markets.length > 0) console.log("New market address:", markets[markets.length - 1]);
  } catch (err) {
    console.error("Failed to read markets:", err);
  }
}

main().catch((e) => {
  console.error("createMarket failed:", e);
  process.exit(1);
});
