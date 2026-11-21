// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ColorSnapChallenge} from "../src/ColorSnapChallenge.sol";
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";

/// @notice Proves the competitive mode's two privacy boundaries: both players
/// can privately decrypt the shared puzzle, while only a proof-verified
/// win/loss boolean becomes public for resolution.
contract ColorSnapChallengeTest is FhevmTest {
    ColorSnapChallenge internal challenge;
    address internal challengeAddress;
    Account internal alice;
    Account internal bob;
    uint256 private encryptNonce;

    function setUp() public override {
        super.setUp();
        challenge = new ColorSnapChallenge();
        challengeAddress = address(challenge);
        alice = makeAccount("alice");
        bob = makeAccount("bob");
    }

    function createAndStart() internal returns (uint256 challengeId) {
        vm.prank(alice.addr);
        challengeId = challenge.createChallenge();
        vm.prank(bob.addr);
        challenge.joinChallenge(challengeId);
    }

    function userDecryptAs(uint256 userPk, bytes32 handle) internal returns (uint256) {
        return userDecrypt(handle, vm.addr(userPk), challengeAddress, signUserDecrypt(userPk, challengeAddress));
    }

    function targetFor(uint256 challengeId, Account memory player) internal returns (uint8[5] memory ids) {
        vm.prank(player.addr);
        euint8[5] memory ciphertexts = challenge.getPuzzleCiphertexts(challengeId);
        for (uint256 i; i < 5; ++i) {
            ids[i] = uint8(userDecryptAs(player.key, FHE.toBytes32(ciphertexts[i])));
        }
    }

    function encryptFive(uint8[5] memory values, address user)
        internal
        returns (externalEuint8[5] memory externalHandles, bytes memory inputProof)
    {
        bytes32[] memory handles = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            ++encryptNonce;
            bytes memory ciphertext =
                abi.encodePacked(keccak256(abi.encodePacked(values[i], uint8(FheType.Uint8), encryptNonce)));
            handles[i] =
                InputProofHelper.computeInputHandle(ciphertext, uint8(i), FheType.Uint8, aclAdd, uint64(block.chainid));
            _plaintexts[handles[i]] = values[i];
            externalHandles[i] = externalEuint8.wrap(handles[i]);
        }
        bytes32 domainSeparator = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest = InputProofHelper.computeInputVerificationDigest(
            handles, user, challengeAddress, block.chainid, EMPTY_EXTRA_DATA, domainSeparator
        );
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        inputProof = InputProofHelper.assembleInputProof(handles, signatures, EMPTY_EXTRA_DATA);
    }

    function submitFor(uint256 challengeId, Account memory player, uint8[5] memory solution) internal {
        (externalEuint8[5] memory submitted, bytes memory proof) = encryptFive(solution, player.addr);
        vm.prank(player.addr);
        challenge.submitSolution(challengeId, submitted, proof);
    }

    function finalizeFor(uint256 challengeId, address player) internal {
        ebool result = challenge.getPublicResultCiphertext(challengeId, player);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(result);
        (uint256[] memory cleartexts, bytes memory proof) = publicDecrypt(handles);
        challenge.finalizeResult(challengeId, player, cleartexts, proof);
    }

    function test_playersPrivatelyDecryptTheSameRandomPuzzle() public {
        uint256 challengeId = createAndStart();
        uint8[5] memory aliceTarget = targetFor(challengeId, alice);
        uint8[5] memory bobTarget = targetFor(challengeId, bob);
        uint256 sum;
        for (uint256 i; i < 5; ++i) {
            assertEq(aliceTarget[i], bobTarget[i]);
            sum += aliceTarget[i];
            for (uint256 j = i + 1; j < 5; ++j) {
                assertTrue(aliceTarget[i] != aliceTarget[j]);
            }
        }
        assertEq(sum, 10);
    }

    function test_publicProofRevealsOnlyWinLossAndResolvesWinner() public {
        uint256 challengeId = createAndStart();
        submitFor(challengeId, alice, targetFor(challengeId, alice));
        uint8[5] memory wrong = [uint8(0), 0, 0, 0, 0];
        submitFor(challengeId, bob, wrong);

        finalizeFor(challengeId, alice.addr);
        finalizeFor(challengeId, bob.addr);
        challenge.resolveChallenge(challengeId);

        (,,,,, address winner,,) = challenge.getChallenge(challengeId);
        assertEq(winner, alice.addr);
    }

    function test_nonPlayerCannotReadPuzzleCiphertexts() public {
        uint256 challengeId = createAndStart();
        vm.expectRevert("Not a challenge player");
        challenge.getPuzzleCiphertexts(challengeId);
    }
}
