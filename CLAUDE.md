# ShramPay: context for Claude Code

Hackathon project for **Monad Blitz Pune V3** (10 Oct 2026).
**Code freeze: 5:30 PM IST. Submissions close: 5:45 PM IST.** Demos 6:00–8:30 PM, 3 minutes per team.

## What it is
Per-second wages for daily-wage / gig workers on Monad Testnet.
Contractor locks ONE day's wages → worker (or supervisor) checks in → pay streams per second, worker can withdraw any time → check-out (worker or supervisor) stops the clock: worker keeps earned, contractor refunded the rest. Crews in one tx. Wage register CSV export. Hindi/English worker view.

## Layout
- `contracts/ShramPay.sol`: the contract (solc 0.8.26, optimizer 200 runs, evm cancun)
- `docs/`: static web app served by GitHub Pages (`index.html`, `config.js`, `artifact.js` generated, `ethers.umd.min.js`, `qrcode.js` vendored)
- `scripts/compile.js`: writes `artifacts/ShramPay.json`, `artifacts/metadata.json`, `artifacts/standard-input.json`, `docs/artifact.js`
- `scripts/deploy.js`: `PRIVATE_KEY=0x… npm run deploy` (or deploy from the UI: Contractor → Admin → Deploy new)
- `scripts/verify.js`: `npm run verify -- <address>` → Monad Sourcify server `https://sourcify-api-monad.blockvision.org` (UNTESTED; fallback: MonadVision "Verify Contract" page with `artifacts/standard-input.json`)
- `test/shrampay.test.js`: 16 tests; run `npm run chain` in one terminal, `npm test` in another

## Rules
- After ANY contract change: `npm run compile` then `npm test`. The deployed bytecode must match the committed source for verification, so don't change the contract after deploying unless you redeploy.
- Never commit private keys or `.env`.
- Keep `docs/` build-free (plain HTML/JS); GitHub Pages serves it as-is from `main` / `/docs`.

## Network
Monad Testnet: chain ID 10143, RPC https://testnet-rpc.monad.xyz, explorer https://testnet.monadvision.com, faucet https://faucet.monad.xyz

## Remaining checklist (judging rubric)
- [ ] Deploy contract to Monad Testnet; put address in `docs/config.js` and README placeholders
- [ ] Verify contract source on the explorer
- [ ] Public GitHub repo pushed; GitHub Pages enabled (main, /docs); live URL in README
- [ ] README: live URL + contract address (someone else must be able to run it from the README alone)
- [ ] Live transaction during the demo
- [ ] Social: post on X/LinkedIn tagging @monad @monad_dev @geeky_kartikey; 30s+ demo video; creative ad video; views count until 5:45 PM
- [ ] Optional bonus: deploy to Monad Mainnet (needs real MON); custom domain
