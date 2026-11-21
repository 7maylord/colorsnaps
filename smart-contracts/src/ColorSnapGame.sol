// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, euint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ColorSnapGame — confidential Classic mode engine (Phase 2)
/// @notice FHEVM-enabled Classic memory-puzzle engine. The encrypted target
///         remains private to the player and the contract; it is not made
///         publicly decryptable. The player receives access to the ciphertext
///         so the frontend can show the target during the game's reveal phase.
///         This protects the puzzle from observers and other players, not from
///         the player whose puzzle it is.
contract ColorSnapGame is ZamaEthereumConfig {
    enum GameStatus {
        NONE,
        ACTIVE,
        SOLUTION_SUBMITTED,
        CANCELLED,
        EXPIRED
    }

    struct Game {
        address player;
        GameStatus status;
        uint256 deadline;
        uint256 createdAt;
        bool hasSubmission;
        uint256 submittedAt;
        euint8[5] target;
        euint8[5] submitted;
        ebool solved;
    }

    struct PrioritizedId {
        euint64 prio;
        euint8 id;
    }

    mapping(uint256 => Game) private games;
    mapping(address => uint256[]) private playerGames;
    uint256 public nextGameId = 1;

    uint256 private constant CLASSIC_DEADLINE_SECONDS = 300;

    event GameCreated(uint256 indexed gameId, address indexed player, uint256 deadline);
    event SolutionSubmitted(uint256 indexed gameId, address indexed player, uint256 submittedAt);
    event GameEnded(uint256 indexed gameId, address indexed player);
    event GameExpired(uint256 indexed gameId, address indexed player);

    // ------------------------------------------------------------------
    // Creation — generates the encrypted target permutation
    // ------------------------------------------------------------------

    /// @notice Creates a new Classic game for the caller. Generates five
    ///         encrypted random priorities, sorts them into an encrypted
    ///         permutation of bottle IDs via an FHE compare-and-swap network,
    ///         and stores the result as the encrypted target.
    function createClassicGame() external returns (uint256 gameId) {
        gameId = nextGameId;
        nextGameId++;

        Game storage g = games[gameId];
        g.player = msg.sender;
        g.status = GameStatus.ACTIVE;
        g.deadline = block.timestamp + CLASSIC_DEADLINE_SECONDS;
        g.createdAt = block.timestamp;

        PrioritizedId[5] memory items;
        for (uint8 i = 0; i < 5; i++) {
            items[i] = PrioritizedId({prio: FHE.randEuint64(), id: FHE.asEuint8(i)});
        }

        // Bubble sort with a fixed network (5 elements): always compare and
        // conditionally swap, so there is no data-dependent control flow.
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 j = 0; j + 1 < 5 - i; j++) {
                _compareSwap(items, j);
            }
        }

        for (uint8 i = 0; i < 5; i++) {
            g.target[i] = items[i].id;
            FHE.allowThis(g.target[i]);
            FHE.allow(g.target[i], msg.sender);
        }

        playerGames[msg.sender].push(gameId);
        emit GameCreated(gameId, msg.sender, g.deadline);
    }

    /// @notice Compare-and-swap two (prio, id) pairs so the smaller sorts left.
    function _compareSwap(PrioritizedId[5] memory items, uint256 j) internal {
        euint64 a = items[j].prio;
        euint64 b = items[j + 1].prio;
        euint8 idA = items[j].id;
        euint8 idB = items[j + 1].id;

        ebool swap = FHE.or(FHE.lt(b, a), FHE.and(FHE.eq(b, a), FHE.lt(idB, idA)));
        items[j].prio = FHE.select(swap, b, a);
        items[j + 1].prio = FHE.select(swap, a, b);
        items[j].id = FHE.select(swap, idB, idA);
        items[j + 1].id = FHE.select(swap, idA, idB);
    }

    // ------------------------------------------------------------------
    // Solution submission — encrypted verification
    // ------------------------------------------------------------------

    /// @notice Accepts the player's encrypted final arrangement and computes
    ///         the encrypted success result: one ebool = all five positions
    ///         match. The plaintext arrangement is never stored or emitted.
    function submitSolution(uint256 gameId, externalEuint8[5] calldata submitted, bytes calldata inputProof) external {
        Game storage g = games[gameId];
        require(g.player == msg.sender, "Not your game");
        require(g.status == GameStatus.ACTIVE, "Game not active");
        require(block.timestamp <= g.deadline, "Game expired");
        require(!g.hasSubmission, "Already submitted");

        ebool solved = FHE.asEbool(true);
        for (uint8 i = 0; i < 5; i++) {
            euint8 sub = FHE.fromExternal(submitted[i], inputProof);
            g.submitted[i] = sub;
            FHE.allowThis(sub);
            ebool matches = FHE.eq(g.target[i], sub);
            solved = FHE.and(solved, matches);
        }
        g.solved = solved;
        g.hasSubmission = true;
        g.submittedAt = block.timestamp;
        g.status = GameStatus.SOLUTION_SUBMITTED;

        FHE.allowThis(solved);
        FHE.allow(solved, msg.sender);

        emit SolutionSubmitted(gameId, msg.sender, g.submittedAt);
    }

    // ------------------------------------------------------------------
    // Ciphertext access / result access
    // ------------------------------------------------------------------

    /// @notice Returns the target ciphertexts to the game's player for the
    ///         client-side reveal. This does not reveal plaintext onchain;
    ///         user decryption still requires the ACL granted at creation.
    function getPuzzleCiphertexts(uint256 gameId) external view returns (euint8[5] memory) {
        Game storage g = games[gameId];
        require(g.player == msg.sender, "Not your game");
        return g.target;
    }

    /// @notice Returns the encrypted result to the owner. The contract does
    ///         not accept an onchain assertion of success: private user
    ///         decryption has no onchain proof. Rewards must use a separately
    ///         designed public-decryption proof flow.
    function getSolutionResult(uint256 gameId) external view returns (ebool) {
        Game storage g = games[gameId];
        require(g.player == msg.sender, "Not your game");
        require(g.status == GameStatus.SOLUTION_SUBMITTED, "Solution not submitted");
        return g.solved;
    }

    /// @notice Forfeits an unfinished game before its deadline.
    function endGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.player == msg.sender, "Not your game");
        require(g.status == GameStatus.ACTIVE, "Game not active");
        require(block.timestamp <= g.deadline, "Game expired");

        g.status = GameStatus.CANCELLED;
        emit GameEnded(gameId, msg.sender);
    }

    /// @notice Marks an active game expired after its deadline. Anyone may
    ///         call this so stale games have a deterministic terminal state.
    function expireGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == GameStatus.ACTIVE, "Game not active");
        require(block.timestamp > g.deadline, "Game not expired");

        g.status = GameStatus.EXPIRED;
        emit GameExpired(gameId, g.player);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Public, non-confidential lifecycle metadata only.
    function getGame(uint256 gameId)
        external
        view
        returns (
            address player,
            GameStatus status,
            uint256 deadline,
            uint256 createdAt,
            bool hasSubmission,
            uint256 submittedAt
        )
    {
        Game storage g = games[gameId];
        return (g.player, g.status, g.deadline, g.createdAt, g.hasSubmission, g.submittedAt);
    }

    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }
}
