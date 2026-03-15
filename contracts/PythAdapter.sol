// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPythCore {
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
    function update(bytes[] calldata updateData) external payable;
}

interface IPythPriceService {
    function getPriceUnsafe(bytes32 id) external view returns (
        int64 price, uint64 conf, int32 expo, uint256 publishTime
    );
}

contract PythAdapter {
    IPythCore public immutable pythCore;
    IPythPriceService public immutable pythPriceService;

    constructor(address _pythCore, address _pythPriceService) {
        pythCore = IPythCore(_pythCore);
        pythPriceService = IPythPriceService(_pythPriceService);
    }

    struct PriceResult {
        int256 price;
        int32 expo;
        uint256 publishTime;
    }

    function applyUpdateAndGetPrice(bytes32 priceId, bytes[] calldata updateData)
        external
        payable
        returns (PriceResult memory)
    {
        uint256 fee = pythCore.getUpdateFee(updateData);
        require(msg.value >= fee, "PythAdapter: insufficient fee");

        pythCore.update{value: fee}(updateData);

        (int64 p, , int32 expo, uint256 publishTime) = pythPriceService.getPriceUnsafe(priceId);

        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "PythAdapter: refund failed");
        }

        return PriceResult({ price: int256(p), expo: expo, publishTime: publishTime });
    }

    receive() external payable {}
}
