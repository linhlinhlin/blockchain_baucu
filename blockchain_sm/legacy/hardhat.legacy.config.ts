import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-ignition";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-verify";

dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? "";
const SEPOLIA_PRIVATE_KEYS = process.env.SEPOLIA_PRIVATE_KEYS
  ? process.env.SEPOLIA_PRIVATE_KEYS.split(",")
  : [];
const POA_RPC_URL = "https://geth.holihu.online/rpc";
const POA_CHAIN_ID = 210;
const POA_PRIVATE_KEYS = process.env.POA_PRIVATE_KEYS
  ? process.env.POA_PRIVATE_KEYS.split(",")
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
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
    poa: {
      url: POA_RPC_URL,
      chainId: POA_CHAIN_ID,
      accounts: POA_PRIVATE_KEYS,
      gas: 8000000,
      loggingEnabled: true,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
