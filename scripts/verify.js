// Verify (publish source of) the deployed contract on MonadVision via Monad's Sourcify server.
// Usage: npm run verify -- <contractAddress> [chainId=10143]
const fs = require("fs"), path = require("path");
(async () => {
  const [address, chain = "10143"] = process.argv.slice(2);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) throw new Error("Usage: npm run verify -- <contractAddress> [chainId]");
  const files = {
    "metadata.json": fs.readFileSync(path.join(__dirname, "../artifacts/metadata.json"), "utf8"),
    "ShramPay.sol": fs.readFileSync(path.join(__dirname, "../contracts/ShramPay.sol"), "utf8"),
  };
  const res = await fetch("https://sourcify-api-monad.blockvision.org/verify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, chain, files }),
  });
  console.log(res.status, await res.text());
  console.log("Check: https://testnet.monadvision.com/address/" + address);
})().catch(e => { console.error(e.message); process.exit(1); });
