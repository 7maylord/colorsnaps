// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IColorSnapDailyResults {
    function getPlayerResult(uint256 day, address player)
        external view returns (bool joined, bool submitted, bool finalized, bool solved, uint256 submittedAt);
}

/// @notice Verified Classic and Daily points with growing Classic puzzles.
/// @dev Only a proof-verified win/loss boolean is public; patterns stay encrypted.
contract ColorSnapArcade is ZamaEthereumConfig {
    struct Game {
        address player;
        uint8 size;
        uint8 status; // 0 missing, 1 active, 2 submitted, 3 cancelled
        uint256 createdAt;
        bool finalized;
        bool solved;
        euint8[7] target;
        ebool encryptedSolved;
    }
    struct LeaderboardEntry { address player; uint256 points; uint256 completedGames; }

    IColorSnapDailyResults public immutable daily;
    uint256 public nextGameId = 1;
    mapping(uint256 => Game) private games;
    mapping(address => uint256[]) private playerGames;
    mapping(address => uint256) public completedGames;
    mapping(address => uint256) public points;
    mapping(uint256 => mapping(address => bool)) public dailyClaimed;
    address[] private players;
    mapping(address => bool) private registered;

    event GameCreated(uint256 indexed gameId, address indexed player, uint8 size);
    event SolutionSubmitted(uint256 indexed gameId, address indexed player);
    event ClassicFinalized(uint256 indexed gameId, address indexed player, bool solved, uint256 totalPoints);
    event DailyClaimed(uint256 indexed day, address indexed player, uint256 totalPoints);
    event GameEnded(uint256 indexed gameId, address indexed player);

    constructor(IColorSnapDailyResults daily_) { require(address(daily_) != address(0), "Invalid daily"); daily = daily_; }

    function nextPuzzleSize(address player) public view returns (uint8) {
        uint256 completed = completedGames[player];
        return completed >= 30 ? 7 : completed >= 10 ? 6 : 5;
    }

    function createClassicGame() external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.player = msg.sender;
        g.size = nextPuzzleSize(msg.sender);
        g.status = 1;
        g.createdAt = block.timestamp;
        euint8[7] memory items;
        for (uint8 i; i < g.size; ++i) items[i] = FHE.asEuint8(i);
        // Odd-even transposition network: random encrypted swaps preserve a
        // permutation and use fewer FHE operations than sorting random keys.
        // Seven bottles use five rounds to remain within the FHE HCU limit.
        uint8 rounds = g.size == 7 ? 5 : g.size;
        for (uint8 round; round < rounds; ++round) {
            for (uint8 j = round % 2; j + 1 < g.size; j += 2) _swap(items, j);
        }
        for (uint8 i; i < g.size; ++i) {
            g.target[i] = items[i];
            FHE.allowThis(g.target[i]);
            FHE.allow(g.target[i], msg.sender);
        }
        playerGames[msg.sender].push(gameId);
        _register(msg.sender);
        emit GameCreated(gameId, msg.sender, g.size);
    }

    function _swap(euint8[7] memory items, uint256 j) internal {
        ebool swap = FHE.randEbool();
        (items[j], items[j + 1]) = (
            FHE.select(swap, items[j + 1], items[j]), FHE.select(swap, items[j], items[j + 1])
        );
    }

    function submitSolution(uint256 gameId, externalEuint8[] calldata input, bytes calldata proof) external {
        Game storage g = games[gameId];
        require(g.player == msg.sender && g.status == 1, "Game unavailable");
        require(input.length == g.size, "Wrong bottle count");
        ebool solved = FHE.asEbool(true);
        for (uint8 i; i < g.size; ++i) {
            euint8 value = FHE.fromExternal(input[i], proof);
            FHE.allowThis(value);
            solved = FHE.and(solved, FHE.eq(g.target[i], value));
        }
        g.encryptedSolved = solved;
        g.status = 2;
        FHE.allowThis(solved);
        FHE.makePubliclyDecryptable(solved);
        emit SolutionSubmitted(gameId, msg.sender);
    }

    function getPuzzleCiphertexts(uint256 gameId) external view returns (euint8[] memory target) {
        Game storage g = games[gameId];
        require(g.player == msg.sender, "Not your game");
        target = new euint8[](g.size);
        for (uint8 i; i < g.size; ++i) target[i] = g.target[i];
    }

    function getPublicResultCiphertext(uint256 gameId) external view returns (ebool) {
        Game storage g = games[gameId];
        require(g.status == 2, "Result unavailable");
        return g.encryptedSolved;
    }

    function finalizeResult(uint256 gameId, uint256[] calldata cleartexts, bytes calldata proof) external {
        Game storage g = games[gameId];
        require(g.status == 2 && !g.finalized, "Already finalized or unavailable");
        require(cleartexts.length == 1 && cleartexts[0] <= 1, "Invalid result");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(g.encryptedSolved);
        FHE.checkSignatures(handles, abi.encode(cleartexts), proof);
        g.finalized = true;
        g.solved = cleartexts[0] == 1;
        completedGames[g.player]++;
        if (g.solved) points[g.player] += 10;
        emit ClassicFinalized(gameId, g.player, g.solved, points[g.player]);
    }

    function claimDaily(uint256 day) external {
        require(!dailyClaimed[day][msg.sender], "Daily already claimed");
        (,, bool finalized, bool solved,) = daily.getPlayerResult(day, msg.sender);
        require(finalized && solved, "No verified Daily win");
        dailyClaimed[day][msg.sender] = true;
        _register(msg.sender);
        points[msg.sender] += 20;
        emit DailyClaimed(day, msg.sender, points[msg.sender]);
    }

    function endGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.player == msg.sender && g.status == 1, "Game unavailable");
        g.status = 3;
        emit GameEnded(gameId, msg.sender);
    }

    function getGame(uint256 gameId) external view returns (address player, uint8 size, uint8 status, uint256 createdAt, bool finalized, bool solved) {
        Game storage g = games[gameId];
        return (g.player, g.size, g.status, g.createdAt, g.finalized, g.solved);
    }
    function getPlayerGames(address player) external view returns (uint256[] memory) { return playerGames[player]; }
    function playerCount() external view returns (uint256) { return players.length; }

    function getLeaderboard(uint256 offset, uint256 limit) external view returns (LeaderboardEntry[] memory entries) {
        require(limit <= 100, "Limit too large");
        LeaderboardEntry[] memory ranked = new LeaderboardEntry[](players.length);
        for (uint256 i; i < players.length; ++i) {
            address player = players[i];
            ranked[i] = LeaderboardEntry(player, points[player], completedGames[player]);
        }
        for (uint256 i; i < ranked.length; ++i) {
            for (uint256 j; j + 1 < ranked.length - i; ++j) {
                if (ranked[j].points < ranked[j + 1].points ||
                    (ranked[j].points == ranked[j + 1].points && uint160(ranked[j].player) > uint160(ranked[j + 1].player))) {
                    (ranked[j], ranked[j + 1]) = (ranked[j + 1], ranked[j]);
                }
            }
        }
        if (offset >= ranked.length) return new LeaderboardEntry[](0);
        uint256 size = ranked.length - offset;
        if (size > limit) size = limit;
        entries = new LeaderboardEntry[](size);
        for (uint256 i; i < size; ++i) entries[i] = ranked[offset + i];
    }

    function _register(address player) internal {
        if (!registered[player]) { registered[player] = true; players.push(player); }
    }
}
