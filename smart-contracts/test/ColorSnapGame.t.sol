// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ColorSnapGame} from "../src/ColorSnapGame.sol";
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";

/// @notice Tests the Classic-mode confidentiality and lifecycle boundaries.
contract ColorSnapGameTest is FhevmTest {
    ColorSnapGame internal game;
    address internal gameAddress;
    Account internal alice;
    Account internal bob;
    uint256 private encryptNonce;

    function setUp() public override {
        super.setUp();
        game = new ColorSnapGame();
        gameAddress = address(game);
        alice = makeAccount("alice");
        bob = makeAccount("bob");
    }

    function userDecryptAs(uint256 userPk, bytes32 handle) internal returns (uint256) {
        return userDecrypt(handle, vm.addr(userPk), gameAddress, signUserDecrypt(userPk, gameAddress));
    }

    function encryptFive(uint8[5] memory values)
        internal
        returns (externalEuint8[5] memory externalHandles, bytes memory inputProof)
    {
        bytes32[] memory handles = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            ++encryptNonce;
            bytes memory ciphertext =
                abi.encodePacked(keccak256(abi.encodePacked(values[i], uint8(FheType.Uint8), encryptNonce)));
            handles[i] =
                InputProofHelper.computeInputHandle(ciphertext, 0, FheType.Uint8, aclAdd, uint64(block.chainid));
            externalHandles[i] = externalEuint8.wrap(handles[i]);
        }
        bytes32 domainSeparator = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest = InputProofHelper.computeInputVerificationDigest(
            handles, gameAddress, gameAddress, block.chainid, EMPTY_EXTRA_DATA, domainSeparator
        );
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        inputProof = InputProofHelper.assembleInputProof(handles, signatures, EMPTY_EXTRA_DATA);
    }

    function createForAlice() internal returns (uint256 gameId) {
        vm.prank(alice.addr);
        gameId = game.createClassicGame();
    }

    function targetForAlice(uint256 gameId) internal returns (uint8[5] memory ids) {
        vm.prank(alice.addr);
        euint8[5] memory ciphertexts = game.getPuzzleCiphertexts(gameId);
        for (uint256 i; i < 5; ++i) {
            ids[i] = uint8(userDecryptAs(alice.key, FHE.toBytes32(ciphertexts[i])));
        }
    }

    function test_createClassicGameCreatesPrivateActivePuzzle() public {
        uint256 gameId = createForAlice();
        (address player, ColorSnapGame.GameStatus status,,, uint256 submittedAt) = game.getGame(gameId);
        assertEq(player, alice.addr);
        assertEq(uint8(status), uint8(ColorSnapGame.GameStatus.ACTIVE));
        assertEq(submittedAt, 0);
    }

    function test_targetIsPermutationAndOwnerCanDecryptForReveal() public {
        uint8[5] memory ids = targetForAlice(createForAlice());
        uint256 sum;
        for (uint256 i; i < 5; ++i) {
            sum += ids[i];
            for (uint256 j = i + 1; j < 5; ++j) {
                assertTrue(ids[i] != ids[j]);
            }
        }
        assertEq(sum, 10);
    }

    function test_nonOwnerCannotUsePuzzleCiphertextEndpoint() public {
        uint256 gameId = createForAlice();
        vm.prank(bob.addr);
        vm.expectRevert("Not your game");
        game.getPuzzleCiphertexts(gameId);
    }

    function test_correctEncryptedSolutionCreatesPrivateSuccessResult() public {
        uint256 gameId = createForAlice();
        (externalEuint8[5] memory submitted, bytes memory proof) = encryptFive(targetForAlice(gameId));
        vm.prank(alice.addr);
        game.submitSolution(gameId, submitted, proof);

        (, ColorSnapGame.GameStatus status,, bool hasSubmission, uint256 submittedAt) = game.getGame(gameId);
        assertEq(uint8(status), uint8(ColorSnapGame.GameStatus.SOLUTION_SUBMITTED));
        assertTrue(hasSubmission);
        assertGt(submittedAt, 0);

        vm.prank(alice.addr);
        ebool result = game.getSolutionResult(gameId);
        assertEq(userDecryptAs(alice.key, FHE.toBytes32(result)), 1);
    }

    function test_wrongEncryptedSolutionCreatesPrivateFailureResult() public {
        uint256 gameId = createForAlice();
        uint8[5] memory wrong = [uint8(0), 0, 0, 0, 0];
        (externalEuint8[5] memory submitted, bytes memory proof) = encryptFive(wrong);
        vm.prank(alice.addr);
        game.submitSolution(gameId, submitted, proof);

        vm.prank(alice.addr);
        ebool result = game.getSolutionResult(gameId);
        assertEq(userDecryptAs(alice.key, FHE.toBytes32(result)), 0);
    }

    function test_cannotSubmitTwiceOrForAnotherPlayer() public {
        uint256 gameId = createForAlice();
        (externalEuint8[5] memory submitted, bytes memory proof) = encryptFive(targetForAlice(gameId));
        vm.prank(alice.addr);
        game.submitSolution(gameId, submitted, proof);

        vm.prank(alice.addr);
        vm.expectRevert("Game not active");
        game.submitSolution(gameId, submitted, proof);

        uint256 otherGame = createForAlice();
        vm.prank(bob.addr);
        vm.expectRevert("Not your game");
        game.submitSolution(otherGame, submitted, proof);
    }

    function test_resultCannotBeRetrievedBeforeSubmission() public {
        uint256 gameId = createForAlice();
        vm.prank(alice.addr);
        vm.expectRevert("Solution not submitted");
        game.getSolutionResult(gameId);
    }
}
