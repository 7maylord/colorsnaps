// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ColorSnapDuelEscrow} from "./ColorSnapDuelEscrow.sol";

/// @notice FHE referee for funded ERC-7984 ColorSnap Duels.
contract ColorSnapDuel is ZamaEthereumConfig {
    struct Item {
        euint64 priority;
        euint8 id;
    }

    struct Duel {
        bool started;
        bool settled;
        address[2] players;
        euint8[5] target;
        ebool[2] solved;
        bool[2] submitted;
        bool[2] finalized;
        bool[2] clearSolved;
        uint256[2] submittedAt;
    }

    ColorSnapDuelEscrow public immutable escrow;
    mapping(uint256 => Duel) private duels;
    uint256 private constant VERIFICATION_GRACE = 1 hours;
    mapping(uint256 => uint256) public verificationDeadline;

    event DuelStarted(uint256 indexed duelId, address indexed playerA, address indexed playerB);
    event SolutionSubmitted(uint256 indexed duelId, address indexed player, uint256 submittedAt);
    event ResultFinalized(uint256 indexed duelId, address indexed player, bool solved);
    event DuelResolved(uint256 indexed duelId, address indexed winner);

    constructor(ColorSnapDuelEscrow escrow_) {
        escrow = escrow_;
    }

    function startDuel(uint256 duelId) external {
        Duel storage d = duels[duelId];
        require(!d.started, "Duel started");
        (address a, address b, ColorSnapDuelEscrow.Status status,,) = escrow.getDuel(duelId);
        require(status == ColorSnapDuelEscrow.Status.FUNDED, "Escrow not funded");
        d.started = true;
        d.players = [a, b];
        verificationDeadline[duelId] = block.timestamp + VERIFICATION_GRACE;
        Item[5] memory items;
        for (uint8 i; i < 5; ++i) {
            items[i] = Item(FHE.randEuint64(), FHE.asEuint8(i));
        }
        for (uint256 i; i < 5; ++i) {
            for (uint256 j; j + 1 < 5 - i; ++j) {
                _swap(items, j);
            }
        }
        for (uint8 i; i < 5; ++i) {
            d.target[i] = items[i].id;
            FHE.allowThis(d.target[i]);
            FHE.allow(d.target[i], a);
            FHE.allow(d.target[i], b);
        }
        emit DuelStarted(duelId, a, b);
    }

    function submitSolution(uint256 duelId, externalEuint8[5] calldata input, bytes calldata proof) external {
        Duel storage d = duels[duelId];
        uint256 index = _index(d, msg.sender);
        require(d.started && !d.settled, "Duel inactive");
        require(!d.submitted[index], "Already submitted");
        ebool solved = FHE.asEbool(true);
        for (uint8 i; i < 5; ++i) {
            euint8 value = FHE.fromExternal(input[i], proof);
            FHE.allowThis(value);
            solved = FHE.and(solved, FHE.eq(d.target[i], value));
        }
        d.solved[index] = solved;
        d.submitted[index] = true;
        d.submittedAt[index] = block.timestamp;
        FHE.allowThis(solved);
        FHE.makePubliclyDecryptable(solved);
        emit SolutionSubmitted(duelId, msg.sender, block.timestamp);
    }

    function getPuzzleCiphertexts(uint256 duelId) external view returns (euint8[5] memory) {
        Duel storage d = duels[duelId];
        _index(d, msg.sender);
        return d.target;
    }

    function getPublicResultCiphertext(uint256 duelId, address player) external view returns (ebool) {
        Duel storage d = duels[duelId];
        uint256 i = _index(d, player);
        require(d.submitted[i], "Solution not submitted");
        return d.solved[i];
    }

    function finalizeResult(uint256 duelId, address player, uint256[] calldata cleartexts, bytes calldata proof)
        external
    {
        Duel storage d = duels[duelId];
        uint256 i = _index(d, player);
        require(d.submitted[i] && !d.finalized[i], "Result unavailable");
        require(cleartexts.length == 1 && cleartexts[0] <= 1, "Invalid result");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(d.solved[i]);
        FHE.checkSignatures(handles, abi.encode(cleartexts), proof);
        d.finalized[i] = true;
        d.clearSolved[i] = cleartexts[0] == 1;
        emit ResultFinalized(duelId, player, d.clearSolved[i]);
    }

    function resolveDuel(uint256 duelId) external {
        Duel storage d = duels[duelId];
        require(d.started && !d.settled, "Duel inactive");
        require((d.finalized[0] && d.finalized[1]) || block.timestamp > verificationDeadline[duelId], "Results pending");
        d.settled = true;
        address winner;
        if (
            d.finalized[0] && d.clearSolved[0]
                && (!d.finalized[1] || !d.clearSolved[1] || d.submittedAt[0] <= d.submittedAt[1])
        ) winner = d.players[0];
        else if (d.finalized[1] && d.clearSolved[1]) winner = d.players[1];
        escrow.settleDuel(duelId, winner);
        emit DuelResolved(duelId, winner);
    }

    function _swap(Item[5] memory x, uint256 j) internal {
        ebool s = FHE.or(
            FHE.lt(x[j + 1].priority, x[j].priority),
            FHE.and(FHE.eq(x[j + 1].priority, x[j].priority), FHE.lt(x[j + 1].id, x[j].id))
        );
        euint64 a = x[j].priority;
        euint8 b = x[j].id;
        x[j].priority = FHE.select(s, x[j + 1].priority, a);
        x[j + 1].priority = FHE.select(s, a, x[j + 1].priority);
        x[j].id = FHE.select(s, x[j + 1].id, b);
        x[j + 1].id = FHE.select(s, b, x[j + 1].id);
    }

    function _index(Duel storage d, address p) internal view returns (uint256) {
        if (p == d.players[0]) return 0;
        if (p == d.players[1]) return 1;
        revert("Not a duel player");
    }
}
