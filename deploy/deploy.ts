import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script for the Factory contract`);

  // Initialize the wallet.
  const wallet = new Wallet("");

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);

  const factoryArtifact = await deployer.loadArtifact("Factory");

  // Estimate contract deployment fee
  const factoryDeploymentFee = await deployer.estimateDeployFee(factoryArtifact, []);
/*
  // OPTIONAL: Deposit funds to L2
  // Comment this block if you already have funds on zkSync.
  const depositHandle = await deployer.zkWallet.deposit({
    to: deployer.zkWallet.address,
    token: utils.ETH_ADDRESS,
    amount: factoryDeploymentFee.mul(2),
  });
  // Wait until the deposit is processed on zkSync
  await depositHandle.wait();*/

  // Deploy the contracts. The returned objects will be of a `Contract` type, similarly to ones in `ethers`.
  const parsedFactoryFee = ethers.utils.formatEther(factoryDeploymentFee.toString());
  console.log(`The Factory deployment is estimated to cost ${parsedFactoryFee} ETH`);
  const factoryContract = await deployer.deploy(factoryArtifact, []);

  // Show the contract info.
  console.log(`Factory was deployed to ${factoryContract.address}`);
}
