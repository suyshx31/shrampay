# ShramPay: paid for every second you work

**Per-second wages for daily-wage and gig workers, on Monad.**

A contractor locks **one day's** wages on-chain *before* work starts. When the worker checks in (or the site supervisor checks them in), pay streams every second, and the worker can withdraw any time. At check-out the clock stops: the worker keeps what they earned, and the contractor gets the unworked part back automatically. No more "come back next week for your money", and no more paying for no-shows.

| | |
|---|---|
| 🌐 **Live app** | https://suyshx31.github.io/shrampay/ |
| 📜 **Contract (Monad Testnet)** | `0x53a8F9DcF6C00c516850918B100Ad38f9A9bee3f` · [view on MonadVision](https://testnet.monadvision.com/address/0x53a8F9DcF6C00c516850918B100Ad38f9A9bee3f) (source verified) |
| 🧪 **Network** | Monad Testnet, chain ID `10143`, RPC `https://testnet-rpc.monad.xyz` |

---

## The problem
Daily-wage and gig workers often get paid late, short, or not at all. The money only moves *after* the work, so the worker carries all the risk and has no proof of what they were promised.

## How ShramPay fixes it
**For the worker**
1. **Wages locked before work.** One day's wage sits in the contract. The worker can see it's there before starting.
2. **Paid every second on site.** Pay streams from check-in, and the worker can withdraw any time.
3. **Built for real workers.** Mobile-first, a big earnings counter, Hindi/English toggle, and a wallet QR to show the supervisor.

**For the contractor / business owner**
1. **Lock one day at a time,** not the whole contract, so little working capital is tied up.
2. **Pay only for time on site.** Check-in starts the clock and check-out stops it. A no-show costs nothing, and a worker who leaves early is paid only for the time worked, with the rest refunded automatically.
3. **Supervisor-run attendance.** The supervisor can check workers in and out, the way sites already work.
4. **Whole crew in one transaction.**
5. **Wage register in one click (CSV):** worker, check-in/out, hours, amount paid, refund. Proof of wage payment for accountants, clients and labour audits.

**Who it's for:** contractors, and the **principal employers** (builders, factories, facility companies) who need proof that their contractors actually paid the workers.

**Why Monad:** per-second wage streaming means many small, frequent transactions (check-ins, withdrawals, crew payroll). It's only practical with fast blocks and very low fees.

---

## Try it (live, no install)
1. Install MetaMask and get test MON from https://faucet.monad.xyz
2. Open the live app. It adds/switches MetaMask to Monad Testnet for you.
3. **Contractor tab:** paste a worker's wallet address, set wage + shift length, click **Lock wages**.
4. **Worker tab** (from the worker's wallet): click **Check in**, watch earnings tick, click **Withdraw all**.

## Run it locally
Requires Node 18+ and Python 3.
```bash
npm install
npm run compile           # builds artifacts/ and docs/artifact.js
npm run chain             # terminal 1: local test chain
npm test                  # terminal 2: 16 contract tests
npm run serve             # open http://localhost:8080
```

## Deploy your own (Monad Testnet)
**Option A, in the browser:** open the app → **Contractor** → **Admin** → **Deploy new** (MetaMask signs it).
**Option B, CLI:** `PRIVATE_KEY=0x… npm run deploy` (use a throwaway testnet wallet; never commit keys).

Then put the address in `docs/config.js` → `contractAddress`, commit, and push.

## Verify the contract source on the explorer
```bash
npm run verify -- <contractAddress>
```
This submits `contracts/ShramPay.sol` + `artifacts/metadata.json` to Monad's Sourcify server (`sourcify-api-monad.blockvision.org`). Compiler: **solc 0.8.26**, optimizer **on, 200 runs**, EVM **cancun**.
Fallback: the MonadVision *Verify Contract* page with `artifacts/standard-input.json` (Standard JSON input).

## Host it (GitHub Pages)
Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder **`/docs`** → Save. The site appears at `https://<username>.github.io/<repo>/`.

---

## Contract API (`contracts/ShramPay.sol`)
| Function | Who | What |
|---|---|---|
| `createShift(worker, durationSeconds, note)` payable | contractor | Lock one worker's shift wage |
| `createCrewShifts(workers[], durationSeconds, note)` payable | contractor | Lock wages for a crew (split equally) |
| `checkIn(id)` | worker or supervisor | Start the shift; pay streams from now |
| `checkOut(id)` | worker or supervisor | Stop the clock now: worker paid what's earned, rest refunded |
| `withdraw(id, amount)` | worker | Withdraw earned wages (`type(uint256).max` = all) |
| `endShift(id)` | contractor | Cancel / end at any stage (full refund if never checked in) |
| `available(id)`, `getShift(id)`, `shiftsOfWorker(addr)`, `shiftsOfContractor(addr)` | anyone | Views |

Safety: re-entrancy guard on payouts, only the worker or their contractor can check in/out, only the worker can withdraw, only the contractor can cancel, and tests confirm the contract balance returns to exactly 0 once all shifts settle.

## Project layout
```
contracts/ShramPay.sol   smart contract
docs/                    the web app (static, served by GitHub Pages)
scripts/                 compile, deploy, verify
test/                    contract tests
artifacts/               ABI, bytecode, metadata, standard JSON input
```

## Roadmap
- **Rupee wages:** INR-pegged stablecoin instead of MON, with UPI cash-out so workers receive rupees
- **Gasless for workers:** contractor sponsors all fees; workers identified by phone number, no crypto needed
- **Principal-employer funding:** the builder/client funds the daily lock directly, or a lender funds it against the contractor's unpaid invoices
- **Advances & deductions** (kharchi) recorded transparently on each shift
- **Private amounts:** prove payment without exposing wage rates publicly
- **Geofenced / QR-scan check-in** at the site gate
- **Work history as proof of income** for micro-loans and welfare schemes

## Team
Built at **Monad Blitz Pune V3** (10 Oct 2026).

## License
MIT
