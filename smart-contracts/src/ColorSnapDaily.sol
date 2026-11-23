// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ColorSnapDaily
/// @notice Permissionless UTC-day confidential ColorSnap challenge registry.
/// @dev A participant may privately decrypt the shared target; only their
/// proof-verified solved boolean and submission time become public.
contract ColorSnapDaily is ZamaEthereumConfig {
    uint256 public constant DAY = 1 days;
    uint256 public constant PUZZLE_SIZE = 5;

    struct PrioritizedId {
        euint64 priority;
        euint8 id;
    }

    struct Participant {
        bool joined;
        bool submitted;
        bool finalized;
        bool solved;
        uint256 submittedAt;
        ebool encryptedSolved;
    }

    struct DailyChallenge {
        bool exists;
        uint256 deadline;
        euint8[5] target;
        address[] players;
        mapping(address => Participant) participants;
    }

    struct LeaderboardEntry {
        address player;
        uint256 submittedAt;
    }

    mapping(uint256 => DailyChallenge) private challenges;

    event DailyChallengeCreated(uint256 indexed day, uint256 deadline);
    event DailyChallengeJoined(uint256 indexed day, address indexed player);
    event DailySolutionSubmitted(uint256 indexed day, address indexed player, uint256 submittedAt);
    event DailyResultFinalized(uint256 indexed day, address indexed player, bool solved);

    /// @notice Creates today's shared encrypted target if it does not exist.
    /// Anyone may initialize it, but no caller controls its random permutation.
    function createToday() external returns (uint256 day) {
        day = currentDay();
        DailyChallenge storage c = challenges[day];
        if (c.exists) return day;

        c.exists = true;
        c.deadline = (day + 1) * DAY;
        _createTarget(c);
        emit DailyChallengeCreated(day, c.deadline);
    }

    function joinToday() external returns (uint256 day) {
        day = currentDay();
        DailyChallenge storage c = challenges[day];
        require(c.exists, "Daily not created");
        require(block.timestamp < c.deadline, "Daily closed");

        Participant storage p = c.participants[msg.sender];
        require(!p.joined, "Already joined");
        p.joined = true;
        c.players.push(msg.sender);

        for (uint8 i; i < PUZZLE_SIZE; ++i) {
            FHE.allow(c.target[i], msg.sender);
        }
        emit DailyChallengeJoined(day, msg.sender);
    }

    function getPuzzleCiphertexts(uint256 day) external view returns (euint8[5] memory) {
        Participant storage p = challenges[day].participants[msg.sender];
        require(p.joined, "Not a daily player");
        return challenges[day].target;
    }

    function submitSolution(uint256 day, externalEuint8[5] calldata submitted, bytes calldata inputProof) external {
        DailyChallenge storage c = challenges[day];
        require(c.exists, "Daily not created");
        require(block.timestamp <= c.deadline, "Daily closed");

        Participant storage p = c.participants[msg.sender];
        require(p.joined, "Not a daily player");
        require(!p.submitted, "Already submitted");

        ebool solved = FHE.asEbool(true);
        for (uint8 i; i < PUZZLE_SIZE; ++i) {
            euint8 value = FHE.fromExternal(submitted[i], inputProof);
            FHE.allowThis(value);
            solved = FHE.and(solved, FHE.eq(c.target[i], value));
        }

        p.submitted = true;
        p.submittedAt = block.timestamp;
        p.encryptedSolved = solved;
        FHE.allowThis(solved);
        FHE.makePubliclyDecryptable(solved);
        emit DailySolutionSubmitted(day, msg.sender, p.submittedAt);
    }

    /// @notice Stores the sole public cleartext: whether the participant solved.
    function finalizeResult(uint256 day, address player, uint256[] calldata cleartexts, bytes calldata proof) external {
        Participant storage p = challenges[day].participants[player];
        require(p.submitted, "Solution not submitted");
        require(!p.finalized, "Result finalized");
        require(cleartexts.length == 1 && cleartexts[0] <= 1, "Invalid result");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(p.encryptedSolved);
        FHE.checkSignatures(handles, abi.encode(cleartexts), proof);
        p.finalized = true;
        p.solved = cleartexts[0] == 1;
        emit DailyResultFinalized(day, player, p.solved);
    }

    function getPublicResultCiphertext(uint256 day, address player) external view returns (ebool) {
        Participant storage p = challenges[day].participants[player];
        require(p.submitted, "Solution not submitted");
        return p.encryptedSolved;
    }

    function getDailyChallenge(uint256 day) external view returns (bool exists, uint256 deadline, uint256 playerCount) {
        DailyChallenge storage c = challenges[day];
        return (c.exists, c.deadline, c.players.length);
    }

    function getPlayerResult(uint256 day, address player)
        external
        view
        returns (bool joined, bool submitted, bool finalized, bool solved, uint256 submittedAt)
    {
        Participant storage p = challenges[day].participants[player];
        return (p.joined, p.submitted, p.finalized, p.solved, p.submittedAt);
    }

    /// @notice Returns only solved, proof-finalized players, ordered by the
    /// original submission timestamp. Earlier submissions win ties by address.
    function getLeaderboard(uint256 day, uint256 offset, uint256 limit)
        external
        view
        returns (LeaderboardEntry[] memory entries)
    {
        require(limit <= 100, "Limit too large");
        DailyChallenge storage c = challenges[day];
        uint256 count;
        for (uint256 i; i < c.players.length; ++i) {
            Participant storage p = c.participants[c.players[i]];
            if (p.finalized && p.solved) ++count;
        }

        if (offset >= count || limit == 0) return new LeaderboardEntry[](0);
        LeaderboardEntry[] memory ranked = new LeaderboardEntry[](count);
        uint256 cursor;
        for (uint256 i; i < c.players.length; ++i) {
            address player = c.players[i];
            Participant storage p = c.participants[player];
            if (p.finalized && p.solved) ranked[cursor++] = LeaderboardEntry(player, p.submittedAt);
        }
        _sort(ranked);

        uint256 size = count - offset;
        if (size > limit) size = limit;
        entries = new LeaderboardEntry[](size);
        for (uint256 i; i < size; ++i) entries[i] = ranked[offset + i];
    }

    function currentDay() public view returns (uint256) {
        return block.timestamp / DAY;
    }

    function _createTarget(DailyChallenge storage c) internal {
        PrioritizedId[5] memory items;
        for (uint8 i; i < PUZZLE_SIZE; ++i) {
            items[i] = PrioritizedId({priority: FHE.randEuint64(), id: FHE.asEuint8(i)});
        }
        for (uint256 i; i < PUZZLE_SIZE; ++i) {
            for (uint256 j; j + 1 < PUZZLE_SIZE - i; ++j) _compareSwap(items, j);
        }
        for (uint8 i; i < PUZZLE_SIZE; ++i) {
            c.target[i] = items[i].id;
            FHE.allowThis(c.target[i]);
        }
    }

    function _compareSwap(PrioritizedId[5] memory items, uint256 j) internal {
        ebool swap = FHE.or(
            FHE.lt(items[j + 1].priority, items[j].priority),
            FHE.and(FHE.eq(items[j + 1].priority, items[j].priority), FHE.lt(items[j + 1].id, items[j].id))
        );
        (items[j].priority, items[j + 1].priority) = (
            FHE.select(swap, items[j + 1].priority, items[j].priority),
            FHE.select(swap, items[j].priority, items[j + 1].priority)
        );
        (items[j].id, items[j + 1].id) = (
            FHE.select(swap, items[j + 1].id, items[j].id), FHE.select(swap, items[j].id, items[j + 1].id)
        );
    }

    function _sort(LeaderboardEntry[] memory entries) internal pure {
        for (uint256 i; i < entries.length; ++i) {
            for (uint256 j; j + 1 < entries.length - i; ++j) {
                if (_after(entries[j], entries[j + 1])) {
                    (entries[j], entries[j + 1]) = (entries[j + 1], entries[j]);
                }
            }
        }
    }

    function _after(LeaderboardEntry memory a, LeaderboardEntry memory b) internal pure returns (bool) {
        return a.submittedAt > b.submittedAt || (a.submittedAt == b.submittedAt && uint160(a.player) > uint160(b.player));
    }
}
