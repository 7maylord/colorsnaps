// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984Mock} from "@openzeppelin/confidential-contracts/mocks/token/ERC7984Mock.sol";
import {ColorSnapDuelEscrow} from "../src/ColorSnapDuelEscrow.sol";

contract ColorSnapDuelEscrowTest is FhevmTest {
    uint64 internal constant STAKE = 100;
    ERC7984Mock internal token;
    ColorSnapDuelEscrow internal escrow;
    Account internal alice;
    Account internal bob;
    Account internal carol;

    function setUp() public override {
        super.setUp();
        alice = makeAccount("alice");
        bob = makeAccount("bob");
        carol = makeAccount("carol");
        token = new ERC7984Mock("Color USD", "cUSD", "");
        escrow = new ColorSnapDuelEscrow(token, address(this), STAKE);
        token.$_mint(alice.addr, 500);
        token.$_mint(bob.addr, 500);
    }

    function createDuel() internal returns (uint256 duelId) {
        vm.prank(alice.addr);
        duelId = escrow.createDuel(bob.addr);
    }

    function deposit(uint256 duelId, Account memory player, uint64 amount) internal {
        (externalEuint64 encrypted, bytes memory proof) = encryptUint64(amount, player.addr, address(token));
        vm.prank(player.addr);
        token.confidentialTransferAndCall(address(escrow), encrypted, proof, abi.encode(duelId));
    }

    function finalize(uint256 duelId, address player) internal {
        ebool result = escrow.getDepositMatchCiphertext(duelId, player);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(result);
        (uint256[] memory cleartexts, bytes memory proof) = publicDecrypt(handles);
        escrow.finalizeDeposit(duelId, player, cleartexts, proof);
    }

    function balanceOf(Account memory player) internal returns (uint256) {
        euint64 balance = token.confidentialBalanceOf(player.addr);
        return
            userDecrypt(
                FHE.toBytes32(balance), player.addr, address(token), signUserDecrypt(player.key, address(token))
            );
    }

    function fund(uint256 duelId) internal {
        deposit(duelId, alice, STAKE);
        finalize(duelId, alice.addr);
        deposit(duelId, bob, STAKE);
        finalize(duelId, bob.addr);
    }

    function test_acceptsVerifiedEqualDepositsAndPaysWinner() public {
        uint256 duelId = createDuel();
        fund(duelId);
        (,, ColorSnapDuelEscrow.Status status,,) = escrow.getDuel(duelId);
        assertEq(uint8(status), uint8(ColorSnapDuelEscrow.Status.FUNDED));

        escrow.settleDuel(duelId, alice.addr);
        assertEq(balanceOf(alice), 600);
        assertEq(balanceOf(bob), 400);
    }

    function test_refundsInvalidDepositAfterProofVerification() public {
        uint256 duelId = createDuel();
        deposit(duelId, alice, STAKE - 1);
        finalize(duelId, alice.addr);
        assertEq(balanceOf(alice), 500);
        (,, ColorSnapDuelEscrow.Status status,,) = escrow.getDuel(duelId);
        assertEq(uint8(status), uint8(ColorSnapDuelEscrow.Status.AWAITING_CREATOR));
    }

    function test_drawRefundsBothPlayersAndRejectsUnauthorizedSettlement() public {
        uint256 duelId = createDuel();
        fund(duelId);
        vm.prank(carol.addr);
        vm.expectRevert("Only referee");
        escrow.settleDuel(duelId, alice.addr);

        escrow.settleDuel(duelId, address(0));
        assertEq(balanceOf(alice), 500);
        assertEq(balanceOf(bob), 500);
    }

    function test_keepsCreatorDepositPendingUntilProofFinalization() public {
        uint256 duelId = createDuel();
        deposit(duelId, alice, STAKE);
        assertEq(balanceOf(alice), 400);
        (,, ColorSnapDuelEscrow.Status status, bool aFinalized,) = escrow.getDuel(duelId);
        assertEq(uint8(status), uint8(ColorSnapDuelEscrow.Status.AWAITING_CREATOR));
        assertFalse(aFinalized);
    }
}
