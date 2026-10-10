// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ShramPay — per-second wages for daily-wage and gig workers, on Monad
/// @notice A contractor locks one day's wages up front. When the worker checks in
///         (themselves, or scanned in by the site supervisor), pay streams to them
///         every second. At check-out the clock stops: the worker keeps what they
///         earned and the contractor is refunded the rest, automatically.
contract ShramPay {
    enum Status { Pending, Active, Ended }

    struct Shift {
        address contractor;
        address worker;
        uint128 ratePerSecond;  // wei per second
        uint64  duration;       // seconds of work paid for
        uint64  startTime;      // set at check-in (0 while pending)
        uint64  stopTime;       // startTime + duration, or earlier if ended early
        uint256 deposit;        // ratePerSecond * duration
        uint256 withdrawn;      // already paid out to worker
        Status  status;
        string  note;           // e.g. "Site B — masonry, 8h"
    }

    uint256 public nextShiftId;
    mapping(uint256 => Shift) public shifts;
    mapping(address => uint256[]) private _byWorker;
    mapping(address => uint256[]) private _byContractor;

    event ShiftCreated(uint256 indexed id, address indexed contractor, address indexed worker, uint256 ratePerSecond, uint256 duration, uint256 deposit, string note);
    event CheckedIn(uint256 indexed id, address indexed worker, uint256 startTime, uint256 stopTime);
    event Withdrawn(uint256 indexed id, address indexed worker, uint256 amount);
    event CheckedOut(uint256 indexed id, address indexed by, uint256 at);
    event ShiftEnded(uint256 indexed id, uint256 paidToWorker, uint256 refundedToContractor);

    error ZeroAddress();
    error InvalidDuration();
    error DepositTooSmall();
    error NotWorker();
    error NotContractor();
    error NotWorkerOrContractor();
    error WrongStatus();
    error AmountTooHigh();
    error TransferFailed();
    error EmptyCrew();

    uint256 private _lock = 1;
    modifier nonReentrant() { require(_lock == 1, "reentrant"); _lock = 2; _; _lock = 1; }

    // ───────────── contractor ─────────────

    /// @notice Lock wages for one worker's shift. msg.value is the full shift wage.
    function createShift(address worker, uint64 durationSeconds, string calldata note) external payable returns (uint256 id) {
        id = _create(worker, durationSeconds, msg.value, note);
        uint256 dust = msg.value - shifts[id].deposit;
        if (dust > 0) _send(msg.sender, dust);
    }

    /// @notice Lock wages for a whole crew in one transaction. msg.value is split equally.
    function createCrewShifts(address[] calldata workers, uint64 durationSeconds, string calldata note)
        external payable returns (uint256 firstId)
    {
        uint256 n = workers.length;
        if (n == 0) revert EmptyCrew();
        uint256 each = msg.value / n;
        uint256 used;
        firstId = nextShiftId;
        for (uint256 k = 0; k < n; k++) {
            uint256 id = _create(workers[k], durationSeconds, each, note);
            used += shifts[id].deposit;
        }
        if (msg.value > used) _send(msg.sender, msg.value - used);
    }

    /// @notice End a shift now. Worker gets everything earned so far; contractor gets the rest.
    ///         Ending before check-in refunds the contractor in full.
    function endShift(uint256 id) external nonReentrant {
        Shift storage s = shifts[id];
        if (msg.sender != s.contractor) revert NotContractor();
        if (s.status == Status.Ended) revert WrongStatus();
        _settle(id, s);
    }

    // ───────────── attendance (worker or site supervisor) ─────────────

    /// @notice Check in: pay starts streaming from this second.
    ///         Callable by the worker, or by the contractor/supervisor scanning the worker in.
    function checkIn(uint256 id) external {
        Shift storage s = shifts[id];
        if (msg.sender != s.worker && msg.sender != s.contractor) revert NotWorkerOrContractor();
        if (s.status != Status.Pending) revert WrongStatus();
        s.status = Status.Active;
        s.startTime = uint64(block.timestamp);
        s.stopTime = uint64(block.timestamp) + s.duration;
        emit CheckedIn(id, s.worker, s.startTime, s.stopTime);
    }

    /// @notice Check out: the clock stops now. Worker is paid everything earned,
    ///         contractor is refunded the unworked part. Worker or supervisor can call it.
    function checkOut(uint256 id) external nonReentrant {
        Shift storage s = shifts[id];
        if (msg.sender != s.worker && msg.sender != s.contractor) revert NotWorkerOrContractor();
        if (s.status != Status.Active) revert WrongStatus();
        emit CheckedOut(id, msg.sender, block.timestamp);
        _settle(id, s);
    }

    // ───────────── worker ─────────────

    /// @notice Withdraw earned wages. Pass type(uint256).max for everything available.
    function withdraw(uint256 id, uint256 amount) external nonReentrant {
        Shift storage s = shifts[id];
        if (msg.sender != s.worker) revert NotWorker();
        if (s.status != Status.Active) revert WrongStatus();
        uint256 avail = _earned(s, block.timestamp) - s.withdrawn;
        if (amount == type(uint256).max) amount = avail;
        if (amount > avail) revert AmountTooHigh();
        s.withdrawn += amount;
        if (s.withdrawn == s.deposit) s.status = Status.Ended; // fully paid out
        emit Withdrawn(id, msg.sender, amount);
        _send(s.worker, amount);
    }

    // ───────────── views ─────────────

    function available(uint256 id) external view returns (uint256) {
        Shift storage s = shifts[id];
        if (s.status != Status.Active) return 0;
        return _earned(s, block.timestamp) - s.withdrawn;
    }

    function getShift(uint256 id) external view returns (Shift memory) { return shifts[id]; }
    function shiftsOfWorker(address w) external view returns (uint256[] memory) { return _byWorker[w]; }
    function shiftsOfContractor(address c) external view returns (uint256[] memory) { return _byContractor[c]; }

    // ───────────── internals ─────────────

    /// Pays the worker what's earned, refunds the rest, closes the shift.
    function _settle(uint256 id, Shift storage s) internal {
        uint256 earned = _earned(s, block.timestamp);
        uint256 toWorker = earned - s.withdrawn;
        uint256 refund = s.deposit - earned;
        if (s.status == Status.Active && block.timestamp < s.stopTime) s.stopTime = uint64(block.timestamp);
        s.withdrawn = earned;
        s.status = Status.Ended;

        emit ShiftEnded(id, toWorker, refund);
        if (toWorker > 0) _send(s.worker, toWorker);
        if (refund > 0) _send(s.contractor, refund);
    }

    function _create(address worker, uint64 duration, uint256 value, string calldata note) internal returns (uint256 id) {
        if (worker == address(0)) revert ZeroAddress();
        if (duration == 0) revert InvalidDuration();
        uint256 rate = value / duration;
        if (rate == 0) revert DepositTooSmall();
        id = nextShiftId++;
        Shift storage s = shifts[id];
        s.contractor = msg.sender;
        s.worker = worker;
        s.ratePerSecond = uint128(rate);
        s.duration = duration;
        s.deposit = rate * duration;
        s.note = note;
        _byWorker[worker].push(id);
        _byContractor[msg.sender].push(id);
        emit ShiftCreated(id, msg.sender, worker, rate, duration, s.deposit, note);
    }

    function _earned(Shift storage s, uint256 t) internal view returns (uint256) {
        if (s.startTime == 0 || t <= s.startTime) return 0;
        uint256 end = t < s.stopTime ? t : s.stopTime;
        return uint256(s.ratePerSecond) * (end - s.startTime);
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
