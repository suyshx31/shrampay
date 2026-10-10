// Deploy ShramPay to Monad Testnet from the CLI (alternative to the "Deploy new" button).
// Usage:  PRIVATE_KEY=0x... node scripts/deploy.js
// Never commit your private key. Use a throwaway testnet wallet funded from https://faucet.monad.xyz
const { ethers } = require("ethers");
const { abi, bytecode } = require("../artifacts/ShramPay.json");
(async () => {
  const rpc = process.env.RPC || "https://testnet-rpc.monad.xyz";
  if (!process.env.PRIVATE_KEY) throw new Error("Set PRIVATE_KEY env var");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(rpc));
  
  console.log("Deploying from", wallet.address);
  const c = await new ethers.ContractFactory(abi, bytecode, wallet).deploy();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("ShramPay deployed at", addr);
  console.log("Explorer: https://testnet.monadvision.com/address/" + addr);
})().catch(e => { console.error(e); process.exit(1); });
