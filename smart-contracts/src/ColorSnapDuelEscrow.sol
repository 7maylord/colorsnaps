// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";

/// @notice ERC-7984 stake escrow for a two-player ColorSnap Duel.
/// @dev The referee is the only address that can settle. It must itself verify
/// FHE win/loss proofs; this contract never trusts a player-supplied outcome.
contract ColorSnapDuelEscrow is ZamaEthereumConfig, IERC7984Receiver {
    enum Status {
        NONE,
        AWAITING_CREATOR,
        AWAITING_OPPONENT,
        FUNDED,
        SETTLED,
        CANCELLED
    }

    struct Duel {
        address playerA;
        address playerB;
        Status status;
        bool[2] depositReceived;
        bool[2] depositFinalized;
        euint64[2] deposits;
        ebool[2] depositMatchesStake;
    }

    IERC7984 public immutable token;
    address public immutable referee;
    uint64 public immutable stake;
    uint256 public nextDuelId = 1;
    mapping(uint256 => Duel) private duels;

    event DuelCreated(uint256 indexed duelId, address indexed playerA, address indexed playerB);
    event DepositReceived(uint256 indexed duelId, address indexed player);
    event DepositFinalized(uint256 indexed duelId, address indexed player, bool accepted);
    event DuelSettled(uint256 indexed duelId, address indexed winner);

    constructor(IERC7984 token_, address referee_, uint64 stake_) {
        require(address(token_) != address(0) && referee_ != address(0) && stake_ != 0, "Invalid configuration");
        token = token_;
        referee = referee_;
        stake = stake_;
    }

    function createDuel(address opponent) external returns (uint256 duelId) {
        require(opponent != address(0) && opponent != msg.sender, "Invalid opponent");
        duelId = nextDuelId++;
        Duel storage d = duels[duelId];
        d.playerA = msg.sender;
        d.playerB = opponent;
        d.status = Status.AWAITING_CREATOR;
        emit DuelCreated(duelId, msg.sender, opponent);
    }

    /// @dev Call via token.confidentialTransferAndCall(address(this), amount,
    /// proof, abi.encode(duelId)). A wrong amount is returned by ERC-7984
    /// because this callback returns an encrypted false value.
    function onConfidentialTransferReceived(address, address from, euint64 amount, bytes calldata data)
        external
        returns (ebool)
    {
        require(msg.sender == address(token), "Only stake token");
        uint256 duelId = abi.decode(data, (uint256));
        Duel storage d = duels[duelId];
        uint256 index;
        if (d.status == Status.AWAITING_CREATOR && from == d.playerA) index = 0;
        else if (d.status == Status.AWAITING_OPPONENT && from == d.playerB) index = 1;
        else revert("Unexpected deposit");
        require(!d.depositReceived[index], "Deposit already received");

        ebool matches = FHE.eq(amount, FHE.asEuint64(stake));
        d.deposits[index] = amount;
        d.depositMatchesStake[index] = matches;
        d.depositReceived[index] = true;
        FHE.allowThis(amount);
        FHE.allowThis(matches);
        FHE.makePubliclyDecryptable(matches);
        // Preserve the transfer until its public boolean is proof-finalized.
        // This prevents encrypted control flow from changing the match state.
        ebool acceptTransfer = FHE.asEbool(true);
        FHE.allowTransient(acceptTransfer, msg.sender);
        emit DepositReceived(duelId, from);
        return acceptTransfer;
    }

    function finalizeDeposit(uint256 duelId, address player, uint256[] calldata cleartexts, bytes calldata proof)
        external
    {
        Duel storage d = duels[duelId];
        uint256 index = _playerIndex(d, player);
        require(d.depositReceived[index], "Deposit not received");
        require(!d.depositFinalized[index], "Deposit finalized");
        require(cleartexts.length == 1 && cleartexts[0] <= 1, "Invalid deposit result");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(d.depositMatchesStake[index]);
        FHE.checkSignatures(handles, abi.encode(cleartexts), proof);
        d.depositFinalized[index] = true;
        bool accepted = cleartexts[0] == 1;
        if (!accepted) {
            d.depositReceived[index] = false;
            token.confidentialTransfer(player, d.deposits[index]);
        } else if (index == 0) {
            d.status = Status.AWAITING_OPPONENT;
        } else {
            d.status = Status.FUNDED;
        }
        emit DepositFinalized(duelId, player, accepted);
    }

    function settleDuel(uint256 duelId, address winner) external {
        require(msg.sender == referee, "Only referee");
        Duel storage d = duels[duelId];
        require(d.status == Status.FUNDED, "Duel not funded");
        require(winner == d.playerA || winner == d.playerB || winner == address(0), "Invalid winner");
        d.status = Status.SETTLED;
        if (winner == address(0)) {
            token.confidentialTransfer(d.playerA, d.deposits[0]);
            token.confidentialTransfer(d.playerB, d.deposits[1]);
        } else {
            // Two transfers avoid synthesizing an aggregate ciphertext and
            // retain the token's encrypted balance checks for each deposit.
            token.confidentialTransfer(winner, d.deposits[0]);
            token.confidentialTransfer(winner, d.deposits[1]);
        }
        emit DuelSettled(duelId, winner);
    }

    function getDuel(uint256 duelId)
        external
        view
        returns (address playerA, address playerB, Status status, bool aFinalized, bool bFinalized)
    {
        Duel storage d = duels[duelId];
        return (d.playerA, d.playerB, d.status, d.depositFinalized[0], d.depositFinalized[1]);
    }

    function getDepositMatchCiphertext(uint256 duelId, address player) external view returns (ebool) {
        Duel storage d = duels[duelId];
        return d.depositMatchesStake[_playerIndex(d, player)];
    }

    function _playerIndex(Duel storage d, address player) internal view returns (uint256) {
        if (player == d.playerA) return 0;
        if (player == d.playerB) return 1;
        revert("Not a duel player");
    }
}
