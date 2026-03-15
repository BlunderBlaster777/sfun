import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";

import dotenv from "dotenv";
dotenv.config();

export default {
  solidity: "0.8.19",
  networks: {
    sonic: {
      type: "http",
      url: process.env.RPC || "https://rpc.soniclabs.com",
      chainId: 146,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : []
    }
  }
};
