const hre = require("hardhat");
const { ethers, network } = hre;
const { saveDeployment } = require("./lib/deployments");

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;
  const feeData = await provider.getFeeData();
  const networkInfo = await provider.getNetwork();

  console.log("Deploying ElectionFactoryV1 with:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", networkInfo.chainId.toString());
  console.log(
    "Gas price / max fee:",
    feeData.gasPrice?.toString() ??
      feeData.maxFeePerGas?.toString() ??
      "provider did not return gas data"
  );

  const Factory = await ethers.getContractFactory("ElectionFactoryV1");
  const factory = await Factory.deploy();
  const deployment = await factory.deploymentTransaction()?.wait();
  const factoryAddress = await factory.getAddress();
  const record = {
    address: factoryAddress,
    blockNumber: deployment?.blockNumber ?? null,
    chainId: networkInfo.chainId.toString(),
    deployer: deployer.address,
    network: network.name,
    timestamp: new Date().toISOString(),
    txHash: deployment?.hash ?? null,
  };
  const stored = saveDeployment(network.name, "factory", record);

  console.log("ElectionFactoryV1 deployed at:", factoryAddress);
  console.log("Deployment record:", stored.latestPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
