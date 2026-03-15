// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PredictionMarket.sol";

contract MarketFactory {
    address public owner;
    address public adapter;
    address public feeRecipient;
    uint256 public protocolFeeBps;

    address[] public markets;

    event MarketCreated(address indexed market, address indexed creator);

    constructor(address _adapter, address _feeRecipient, uint256 _protocolFeeBps) {
        require(_adapter != address(0), "Invalid adapter");
        owner = msg.sender;
        adapter = _adapter;
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
    }

    function createMarket(
        uint256 strike,
        uint256 startTime,
        uint256 endTime,
        uint256 minBet,
        bytes32 priceId
    ) external returns (address) {
        PredictionMarket m = new PredictionMarket(
            msg.sender,
            strike,
            startTime,
            endTime,
            minBet,
            priceId,
            adapter,
            feeRecipient,
            protocolFeeBps
        );
        markets.push(address(m));
        emit MarketCreated(address(m), msg.sender);
        return address(m);
    }

    function setAdapter(address _adapter) external {
        require(msg.sender == owner, "Only owner");
        adapter = _adapter;
    }

    function setFeeRecipient(address _recipient) external {
        require(msg.sender == owner, "Only owner");
        feeRecipient = _recipient;
    }

    function setProtocolFeeBps(uint256 _bps) external {
        require(msg.sender == owner, "Only owner");
        protocolFeeBps = _bps;
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }
}
