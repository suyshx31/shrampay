// Run: npx hardhat node  (in another terminal), then: node test/shrampay.test.js
const { ethers } = require("ethers");
const assert = require("assert");
const { abi, bytecode } = require("../artifacts/ShramPay.json");
const E = ethers.parseEther;

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC || "http://127.0.0.1:8545", undefined, { cacheTimeout: -1 });
  const [boss, w1, w2, w3, stranger] = await Promise.all([0, 1, 2, 3, 4].map(i => provider.getSigner(i)));
  const [W1, W2, W3] = await Promise.all([w1, w2, w3].map(s => s.getAddress()));
  const warp = async s => { await provider.send("evm_increaseTime", [s]); await provider.send("evm_mine", []); };
  const bal = a => provider.getBalance(a);
  const gasOf = rc => rc.gasUsed * rc.gasPrice;
  const sp = await (await new ethers.ContractFactory(abi, bytecode, boss).deploy()).waitForDeployment();

  // 1) create a shift: 0.8 MON for 800s -> 0.001 MON/s
  await (await sp.createShift(W1, 800, "Site A - masonry", { value: E("0.8") })).wait();
  let s = await sp.getShift(0);
  assert.equal(s.ratePerSecond, E("0.001")); assert.equal(s.status, 0n);
  console.log("✓ shift created (pending), 0.001 MON/s");

  // 2) nothing streams before check-in
  await warp(100); assert.equal(await sp.available(0), 0n); console.log("✓ no pay before check-in");
  await assert.rejects(sp.connect(stranger).checkIn(0)); console.log("✓ strangers cannot check in");

  // 3) check in, earn
  await (await sp.connect(w1).checkIn(0)).wait();
  await assert.rejects(sp.connect(w1).checkIn(0)); console.log("✓ double check-in rejected");
  await warp(100);
  const a = await sp.available(0); assert(a >= E("0.1") && a <= E("0.101"), "avail " + a);
  console.log("✓ after 100s on shift:", ethers.formatEther(a), "MON");

  // 4) partial withdraw + overdraw protection
  const b0 = await bal(W1); const rc = await (await sp.connect(w1).withdraw(0, E("0.05"))).wait();
  assert.equal((await bal(W1)) - b0 + gasOf(rc), E("0.05"));
  await assert.rejects(sp.connect(w1).withdraw(0, E("1"))); await assert.rejects(sp.connect(stranger).withdraw(0, 1n));
  console.log("✓ worker withdrew 0.05 mid-shift; overdraw and strangers rejected");

  // 5) contractor ends shift early at ~t=300
  await warp(199);
  const wb = await bal(W1), cb = await bal(await boss.getAddress());
  const erc = await (await sp.endShift(0)).wait();
  const toWorker = (await bal(W1)) - wb, refund = (await bal(await boss.getAddress())) - cb + gasOf(erc);
  assert.equal(toWorker + E("0.05") + refund, E("0.8")); // nothing lost or created
  assert(toWorker + E("0.05") >= E("0.3") && toWorker + E("0.05") <= E("0.305"), "worker total " + (toWorker + E("0.05")));
  assert.equal((await sp.getShift(0)).status, 2n);
  await assert.rejects(sp.endShift(0)); await assert.rejects(sp.connect(w1).withdraw(0, 1n));
  console.log("✓ ended early: worker", ethers.formatEther(toWorker + E("0.05")), "+ contractor refund", ethers.formatEther(refund), "= 0.8 deposit, shift closed");

  // 6) end before check-in = full refund
  await (await sp.createShift(W2, 600, "no-show", { value: E("0.6") })).wait();
  const cb2 = await bal(await boss.getAddress()); const r2 = await (await sp.endShift(1)).wait();
  assert.equal((await bal(await boss.getAddress())) - cb2 + gasOf(r2), E("0.6"));
  console.log("✓ worker never checked in -> contractor refunded in full");

  // 7) crew of 3 in one tx, full shift, withdraw everything
  await (await sp.createCrewShifts([W1, W2, W3], 60, "Crew - Site B", { value: E("0.9") })).wait();
  for (const [id, w] of [[2, w1], [3, w2], [4, w3]]) await (await sp.connect(w).checkIn(id)).wait();
  await warp(120);
  for (const [id, w] of [[2, w1], [3, w2], [4, w3]]) await (await sp.connect(w).withdraw(id, ethers.MaxUint256)).wait();
  for (const id of [2, 3, 4]) { const x = await sp.getShift(id); assert.equal(x.withdrawn, E("0.3")); assert.equal(x.status, 2n); }
  assert.deepEqual((await sp.shiftsOfWorker(W1)).map(Number), [0, 2]);
  assert.equal((await sp.shiftsOfContractor(await boss.getAddress())).length, 5);
  console.log("✓ crew of 3 paid in one tx, all fully withdrawn; indexes correct");

  // 8) supervisor (contractor) checks a worker in by scanning; worker checks out early
  await (await sp.createShift(W2, 1000, "Site C", { value: E("1") })).wait(); // id 5, 0.001/s
  await assert.rejects(sp.connect(stranger).checkIn(5)); console.log("✓ strangers cannot check a worker in");
  await assert.rejects(sp.connect(w2).checkOut(5)); console.log("✓ cannot check out before check-in");
  await (await sp.checkIn(5)).wait(); // supervisor scan-in
  assert.equal((await sp.getShift(5)).status, 1n); console.log("✓ supervisor checked worker in");
  await warp(99);
  const wb5 = await bal(W2), cb5 = await bal(await boss.getAddress());
  const co = await (await sp.connect(w2).checkOut(5)).wait();
  const got5 = (await bal(W2)) - wb5 + gasOf(co), ref5 = (await bal(await boss.getAddress())) - cb5;
  assert.equal(got5 + ref5, E("1")); assert(got5 >= E("0.1") && got5 <= E("0.101"), "got " + got5);
  console.log("✓ worker checked out at ~100s: paid", ethers.formatEther(got5), "/ refunded", ethers.formatEther(ref5));
  await assert.rejects(sp.connect(w2).checkOut(5)); console.log("✓ double check-out rejected");

  // 9) supervisor checks a worker out (worker walked off site)
  await (await sp.createShift(W3, 1000, "Site D", { value: E("1") })).wait(); // id 6
  await (await sp.connect(w3).checkIn(6)).wait(); await warp(49);
  await assert.rejects(sp.connect(stranger).checkOut(6));
  await (await sp.checkOut(6)).wait();
  const s6 = await sp.getShift(6); assert.equal(s6.status, 2n); assert(s6.withdrawn >= E("0.05") && s6.withdrawn <= E("0.051"));
  console.log("✓ supervisor checked worker out; stranger rejected; worker paid", ethers.formatEther(s6.withdrawn));

  // 10) contract holds nothing left over
  assert.equal(await bal(await sp.getAddress()), 0n);
  console.log("✓ contract balance is exactly 0 after all shifts settle");
  console.log("\nAll tests passed.");
})().catch(e => { console.error(e); process.exit(1); });
