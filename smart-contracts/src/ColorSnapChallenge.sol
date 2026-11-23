// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ColorSnapChallenge
/// @notice Two players privately receive the same randomly generated memory
/// puzzle. Only each player's win/loss boolean is publicly decryptable and
/// must be finalized with a Zama KMS proof before it affects the outcome.
contract ColorSnapChallenge is ZamaEthereumConfig {
    enum ChallengeStatus {
        NONE,
        WAITING,
        ACTIVE,
        RESOLVED,
        CANCELLED
    }

    struct PrioritizedId {
        euint64 prio;
        euint8 id;
    }

    struct Challenge {
        address playerA;
        address playerB;
        ChallengeStatus status;
        uint256 deadline;
        uint256 verificationDeadline;
        address winner;
        euint8[5] target;
        ebool[2] solved;
        bool[2] submitted;
        bool[2] finalized;
        bool[2] clearSolved;
        uint256[2] submittedAt;
    }

    uint256 public nextChallengeId = 1;
    uint256 private constant CHALLENGE_DURATION = 5 minutes;
    uint256 private constant VERIFICATION_GRACE = 1 hours;
    mapping(uint256 => Challenge) private challenges;

    event ChallengeCreated(uint256 indexed challengeId, address indexed creator);
    event ChallengeStarted(
        uint256 indexed challengeId, address indexed playerA, address indexed playerB, uint256 deadline
    );
    event SolutionSubmitted(uint256 indexed challengeId, address indexed player, uint256 submittedAt);
    event ResultFinalized(uint256 indexed challengeId, address indexed player, bool solved);
    event ChallengeResolved(uint256 indexed challengeId, address indexed winner);
    event ChallengeCancelled(uint256 indexed challengeId);

    function createChallenge() external returns (uint256 challengeId) {
        challengeId = nextChallengeId++;
        Challenge storage c = challenges[challengeId];
        c.playerA = msg.sender;
        c.status = ChallengeStatus.WAITING;
        emit ChallengeCreated(challengeId, msg.sender);
    }

    function joinChallenge(uint256 challengeId) external {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.WAITING, "Challenge not waiting");
        require(msg.sender != c.playerA, "Cannot join your challenge");
        c.playerB = msg.sender;
        c.status = ChallengeStatus.ACTIVE;
        c.deadline = block.timestamp + CHALLENGE_DURATION;
        c.verificationDeadline = c.deadline + VERIFICATION_GRACE;
        _createTarget(c);
        emit ChallengeStarted(challengeId, c.playerA, c.playerB, c.deadline);
    }

    function _createTarget(Challenge storage c) internal {
        PrioritizedId[5] memory items;
        for (uint8 i; i < 5; ++i) {
            items[i] = PrioritizedId({prio: FHE.randEuint64(), id: FHE.asEuint8(i)});
        }
        for (uint256 i; i < 5; ++i) {
            for (uint256 j; j + 1 < 5 - i; ++j) {
                _compareSwap(items, j);
            }
        }
        for (uint8 i; i < 5; ++i) {
            c.target[i] = items[i].id;
            FHE.allowThis(c.target[i]);
            FHE.allow(c.target[i], c.playerA);
            FHE.allow(c.target[i], c.playerB);
        }
    }

    function _compareSwap(PrioritizedId[5] memory items, uint256 j) internal {
        ebool swap = FHE.or(
            FHE.lt(items[j + 1].prio, items[j].prio),
            FHE.and(FHE.eq(items[j + 1].prio, items[j].prio), FHE.lt(items[j + 1].id, items[j].id))
        );
        (items[j].prio, items[j + 1].prio) =
        (FHE.select(swap, items[j + 1].prio, items[j].prio), FHE.select(swap, items[j].prio, items[j + 1].prio));
        (items[j].id, items[j + 1].id) =
        (FHE.select(swap, items[j + 1].id, items[j].id), FHE.select(swap, items[j].id, items[j + 1].id));
    }

    function getPuzzleCiphertexts(uint256 challengeId) external view returns (euint8[5] memory) {
        Challenge storage c = challenges[challengeId];
        require(msg.sender == c.playerA || msg.sender == c.playerB, "Not a challenge player");
        return c.target;
    }

    function submitSolution(uint256 challengeId, externalEuint8[5] calldata submitted, bytes calldata inputProof)
        external
    {
        Challenge storage c = challenges[challengeId];
        uint256 playerIndex = _playerIndex(c, msg.sender);
        require(c.status == ChallengeStatus.ACTIVE, "Challenge not active");
        require(block.timestamp <= c.deadline, "Challenge expired");
        require(!c.submitted[playerIndex], "Already submitted");
        ebool solved = FHE.asEbool(true);
        for (uint8 i; i < 5; ++i) {
            euint8 value = FHE.fromExternal(submitted[i], inputProof);
            FHE.allowThis(value);
            solved = FHE.and(solved, FHE.eq(c.target[i], value));
        }
        c.solved[playerIndex] = solved;
        c.submitted[playerIndex] = true;
        c.submittedAt[playerIndex] = block.timestamp;
        FHE.allowThis(solved);
        FHE.makePubliclyDecryptable(solved);
        emit SolutionSubmitted(challengeId, msg.sender, block.timestamp);
    }

    /// @notice Verifies the KMS proof for the only public cleartext: whether
    /// the player solved the challenge. It cannot reveal the target or input.
    function finalizeResult(
        uint256 challengeId,
        address player,
        uint256[] calldata cleartexts,
        bytes calldata decryptionProof
    ) external {
        Challenge storage c = challenges[challengeId];
        uint256 playerIndex = _playerIndex(c, player);
        require(c.submitted[playerIndex], "Solution not submitted");
        require(!c.finalized[playerIndex], "Result finalized");
        require(cleartexts.length == 1 && cleartexts[0] <= 1, "Invalid result");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(c.solved[playerIndex]);
        FHE.checkSignatures(handles, abi.encode(cleartexts), decryptionProof);
        c.finalized[playerIndex] = true;
        c.clearSolved[playerIndex] = cleartexts[0] == 1;
        emit ResultFinalized(challengeId, player, cleartexts[0] == 1);
    }

    /// @notice Returns the encrypted win/loss handle after a submission. The
    /// handle was deliberately made publicly decryptable in submitSolution;
    /// this endpoint exposes no target or submitted bottle IDs.
    function getPublicResultCiphertext(uint256 challengeId, address player) external view returns (ebool) {
        Challenge storage c = challenges[challengeId];
        uint256 playerIndex = _playerIndex(c, player);
        require(c.submitted[playerIndex], "Solution not submitted");
        return c.solved[playerIndex];
    }

    /// @notice Resolves only after both results are proof-verified, or once
    /// the public verification grace period has ended. Callback arrival order
    /// never chooses the winner; original submission timestamps do.
    function resolveChallenge(uint256 challengeId) external {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.ACTIVE, "Challenge not active");
        require((c.finalized[0] && c.finalized[1]) || block.timestamp > c.verificationDeadline, "Results pending");
        c.status = ChallengeStatus.RESOLVED;
        if (
            c.finalized[0] && c.clearSolved[0]
                && (!c.finalized[1] || !c.clearSolved[1] || c.submittedAt[0] <= c.submittedAt[1])
        ) c.winner = c.playerA;
        else if (c.finalized[1] && c.clearSolved[1]) c.winner = c.playerB;
        emit ChallengeResolved(challengeId, c.winner);
    }

    function cancelChallenge(uint256 challengeId) external {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.WAITING && c.playerA == msg.sender, "Cannot cancel challenge");
        c.status = ChallengeStatus.CANCELLED;
        emit ChallengeCancelled(challengeId);
    }

    function getChallenge(uint256 challengeId)
        external
        view
        returns (
            address playerA,
            address playerB,
            ChallengeStatus status,
            uint256 deadline,
            uint256 verificationDeadline,
            address winner,
            bool playerASubmitted,
            bool playerBSubmitted
        )
    {
        Challenge storage c = challenges[challengeId];
        return
            (
                c.playerA,
                c.playerB,
                c.status,
                c.deadline,
                c.verificationDeadline,
                c.winner,
                c.submitted[0],
                c.submitted[1]
            );
    }

    function _playerIndex(Challenge storage c, address player) internal view returns (uint256) {
        if (player == c.playerA) return 0;
        if (player == c.playerB) return 1;
        revert("Not a challenge player");
    }
}
