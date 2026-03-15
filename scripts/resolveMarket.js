import hre from "hardhat";

async function main() {
  const marketAddress = "0x01a105be58F36cC89ecbFC465c84c9543d1692EF";
  const outcome = 2;

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", signer.address);

  const Market = await hre.ethers.getContractFactory("PredictionMarket");
  const market = Market.attach(marketAddress).connect(signer);

  if (typeof market.resolve === "function") {
    const tx = await market.resolve(outcome);
    console.log("Sent resolve tx:", tx.hash);
    await tx.wait();
    console.log("Resolved via resolve()");
    return;
  }
  if (typeof market.adminResolve === "function") {
    const tx = await market.adminResolve(outcome);
    console.log("Sent resolve tx:", tx.hash);
    await tx.wait();
    console.log("Resolved via adminResolve()");
    return;
  }

  console.error("No known resolve function found on contract. Check ABI and function name.");
}

main().catch(e => { console.error(e); process.exit(1); });
