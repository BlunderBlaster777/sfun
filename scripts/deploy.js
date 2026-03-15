// scripts/deploy.js
import hre from "hardhat";
import dotenv from "dotenv";
import { ethers as ethersLib } from "ethers";
dotenv.config();

async function main() {
  const rpcUrl = process.env.RPC || "http://127.0.0.1:8545";
  const provider = new ethersLib.providers.JsonRpcProvider(rpcUrl);

  // Create deployer wallet from DEPLOYER_KEY if provided, otherwise use first Hardhat signer
  let deployerWallet;
  if (process.env.DEPLOYER_KEY && process.env.DEPLOYER_KEY !== "") {
    deployerWallet = new ethersLib.Wallet(process.env.DEPLOYER_KEY, provider);
    console.log("Using DEPLOYER_KEY:", deployerWallet.address);
  } else {
    const signers = await hre.ethers.getSigners();
    const signerAddress = await signers[0].getAddress();
    // Wrap the unlocked signer address with an ethers Wallet connected to provider
    deployerWallet = new ethersLib.Wallet(signerAddress, provider);
    console.log("Using unlocked signer (wrapped):", signerAddress);
  }

  // Helper to deploy using artifact + ethers ContractFactory
  async function deployFromArtifact(name, constructorArgs = []) {
    const artifact = await hre.artifacts.readArtifact(name);
    const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployerWallet);
    const contract = await factory.deploy(...constructorArgs);
    await contract.deployed();
    console.log(`${name} deployed at:`, contract.address);
    return contract;
  }

  // Deploy PythAdapter
  const pythCore = process.env.PYTH_CORE || ethersLib.constants.AddressZero;
  const pythPriceService = process.env.PYTH_PRICE_SERVICE || ethersLib.constants.AddressZero;
  console.log("Deploying PythAdapter...");
  const adapter = await deployFromArtifact("PythAdapter", [pythCore, pythPriceService]);

  // Deploy MarketFactory
  const feeRecipient = process.env.FEE_RECIPIENT || deployerWallet.address;
  const protocolFeeBps = process.env.PROTOCOL_FEE_BPS ? Number(process.env.PROTOCOL_FEE_BPS) : 100;
  console.log("Deploying MarketFactory...");
  const factory = await deployFromArtifact("MarketFactory", [adapter.address, feeRecipient, protocolFeeBps]);

  console.log("\n--- Deployment summary ---");
  console.log("Deployer:", deployerWallet.address);
  console.log("PythAdapter:", adapter.address);
  console.log("MarketFactory:", factory.address);
  console.log("--------------------------\n");
  console.log("Add the MarketFactory address to your .env as FACTORY_ADDRESS or pass it to createMarket.js.");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
