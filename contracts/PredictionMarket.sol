// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PythAdapter.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is ReentrancyGuard, Ownable {
    enum Side { No, Yes }

    // Immutable parameters
    address public factory;
    address public creator;
    uint256 public strike; // strike scaled to the same exponent as Pyth price used
    uint256 public startTime;
    uint256 public endTime;
    uint256 public minBet;
    bytes32 public priceId;
    PythAdapter public adapter;

    // Mutable state
    uint256 public totalYes;
    uint256 public totalNo;
    bool public settled;
    bool public canceled;
    int256 public settledPrice;
    uint256 public publishTimeUsed;

    // Bets: store amount per side per user
    mapping(address => uint256) public yesBets;
    mapping(address => uint256) public noBets;
    mapping(address => bool) public claimed;

    // Protocol fee in basis points (e.g., 100 = 1%)
    uint256 public protocolFeeBps;
    address public feeRecipient;

    event BetPlaced(address indexed user, Side side, uint256 amount);
    event MarketSettled(int256 price, uint256 publishTime, bool outcomeYes);
    event MarketCanceled();
    event Claimed(address indexed user, uint256 amount);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    /// @notice Constructor called by MarketFactory
    /// @dev Adapter address is cast to payable before converting to contract type.
    constructor(
        address _creator,
        uint256 _strike,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minBet,
        bytes32 _priceId,
        address _adapter,
        address _feeRecipient,
        uint256 _protocolFeeBps
    ) {
        require(_startTime < _endTime, "Invalid times");
        require(_adapter != address(0), "Invalid adapter");
        creator = _creator;
        factory = msg.sender; // factory is deployer
        strike = _strike;
        startTime = _startTime;
        endTime = _endTime;
        minBet = _minBet;
        priceId = _priceId;
        // Fix: convert to payable address before casting to contract type
        adapter = PythAdapter(payable(_adapter));
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
    }

    // Place a bet on yes (true) or no (false)
    function placeBet(bool _yes) external payable nonReentrant {
        require(block.timestamp >= startTime && block.timestamp < endTime, "Betting closed");
        require(msg.value >= minBet, "Below min bet");
        if (_yes) {
            yesBets[msg.sender] += msg.value;
            totalYes += msg.value;
            emit BetPlaced(msg.sender, Side.Yes, msg.value);
        } else {
            noBets[msg.sender] += msg.value;
            totalNo += msg.value;
            emit BetPlaced(msg.sender, Side.No, msg.value);
        }
    }

    // Cancel market before start or by factory in emergency
    function cancelMarket() external {
        require(!settled, "Already settled");
        require(!canceled, "Already canceled");
        require(msg.sender == creator || msg.sender == factory || block.timestamp < startTime, "Not allowed");
        canceled = true;
        emit MarketCanceled();
    }

    /// @notice Settle market by providing Pyth updateData. Caller must forward fee.
    /// @dev Adapter will refund any excess ETH to caller.
    function settle(bytes[] calldata updateData) external payable nonReentrant {
        require(!settled && !canceled, "Already settled or canceled");

        // Apply update via adapter; adapter will refund excess
        PythAdapter.PriceResult memory res = adapter.applyUpdateAndGetPrice(priceId, updateData);

        require(res.publishTime >= endTime, "Publish time before endTime");
        require(publishTimeUsed == 0, "Already used publishTime");

        // Record settlement
        publishTimeUsed = res.publishTime;
        settledPrice = res.price;
        settled = true;

        bool outcomeYes = _comparePriceToStrike(res.price);
        emit MarketSettled(res.price, res.publishTime, outcomeYes);
    }

    // Compare price to strike. strike must be scaled to same exponent as price.
    function _comparePriceToStrike(int256 price) internal view returns (bool) {
        return price >= int256(strike);
    }

    // Claim winnings or refunds
    function claim() external nonReentrant {
        require(settled || canceled, "Not settled or canceled");
        require(!claimed[msg.sender], "Already claimed");
        claimed[msg.sender] = true;

        uint256 payout = 0;
        if (canceled) {
            // refund full bets
            payout = yesBets[msg.sender] + noBets[msg.sender];
        } else {
            // settled: compute winner pool and user share
            bool outcomeYes = _comparePriceToStrike(settledPrice);
            uint256 winnerPool = outcomeYes ? totalYes : totalNo;
            uint256 loserPool = outcomeYes ? totalNo : totalYes;
            uint256 userStake = outcomeYes ? yesBets[msg.sender] : noBets[msg.sender];

            if (userStake == 0) {
                payout = 0;
            } else {
                // total returned to winners = winnerPool + loserPool
                // user's gross share = userStake / winnerPool * (winnerPool + loserPool)
                // compute with care to avoid rounding issues
                uint256 grossShare = (userStake * (winnerPool + loserPool)) / winnerPool;

                // profit = grossShare - userStake
                uint256 profit = grossShare > userStake ? grossShare - userStake : 0;
                uint256 fee = (profit * protocolFeeBps) / 10000;
                payout = grossShare - fee;

                if (fee > 0 && feeRecipient != address(0)) {
                    (bool okFee, ) = feeRecipient.call{value: fee}("");
                    require(okFee, "Fee transfer failed");
                }
            }
        }

        if (payout > 0) {
            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "Payout failed");
        }

        emit Claimed(msg.sender, payout);
    }

    // Owner functions (owner is the deployer of this contract; factory owner can be set accordingly)
    function setProtocolFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Fee too high");
        protocolFeeBps = _bps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    receive() external payable {}
}
