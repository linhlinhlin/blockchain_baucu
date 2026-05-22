import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-verify";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config({ override: true });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_PRIVATE_KEYS = process.env.SEPOLIA_PRIVATE_KEYS
  ? process.env.SEPOLIA_PRIVATE_KEYS.split(",")
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    ...(SEPOLIA_RPC_URL
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            chainId: 11155111,
            accounts: SEPOLIA_PRIVATE_KEYS,
          },
        }
      : {}),
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
