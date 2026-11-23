// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ColorSnapDaily} from "../src/ColorSnapDaily.sol";
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";

contract ColorSnapDailyTest is FhevmTest {
    ColorSnapDaily internal daily;
    address internal dailyAddress;
    Account internal alice;
    Account internal bob;
    Account internal carol;
    uint256 private encryptNonce;

    function setUp() public override {
        super.setUp();
        daily = new ColorSnapDaily();
        dailyAddress = address(daily);
        alice = makeAccount("alice");
        bob = makeAccount("bob");
        carol = makeAccount("carol");
    }

    function createAndJoin() internal returns (uint256 day) {
        vm.prank(alice.addr);
        day = daily.createToday();
        vm.prank(alice.addr);
        daily.joinToday();
        vm.prank(bob.addr);
        daily.joinToday();
    }

    function userDecryptAs(uint256 userPk, bytes32 handle) internal returns (uint256) {
        return userDecrypt(handle, vm.addr(userPk), dailyAddress, signUserDecrypt(userPk, dailyAddress));
    }

    function targetFor(uint256 day, Account memory player) internal returns (uint8[5] memory ids) {
        vm.prank(player.addr);
        euint8[5] memory ciphertexts = daily.getPuzzleCiphertexts(day);
        for (uint256 i; i < 5; ++i) ids[i] = uint8(userDecryptAs(player.key, FHE.toBytes32(ciphertexts[i])));
    }

    function encryptFive(uint8[5] memory values, address user)
        internal
        returns (externalEuint8[5] memory externalHandles, bytes memory inputProof)
    {
        bytes32[] memory handles = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            ++encryptNonce;
            bytes memory ciphertext = abi.encodePacked(keccak256(abi.encodePacked(values[i], uint8(FheType.Uint8), encryptNonce)));
            handles[i] = InputProofHelper.computeInputHandle(ciphertext, uint8(i), FheType.Uint8, aclAdd, uint64(block.chainid));
            _plaintexts[handles[i]] = values[i];
            externalHandles[i] = externalEuint8.wrap(handles[i]);
        }
        bytes32 domainSeparator = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest = InputProofHelper.computeInputVerificationDigest(
            handles, user, dailyAddress, block.chainid, EMPTY_EXTRA_DATA, domainSeparator
        );
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        inputProof = InputProofHelper.assembleInputProof(handles, signatures, EMPTY_EXTRA_DATA);
    }

    function submitFor(uint256 day, Account memory player, uint8[5] memory solution) internal {
        (externalEuint8[5] memory submitted, bytes memory proof) = encryptFive(solution, player.addr);
        vm.prank(player.addr);
        daily.submitSolution(day, submitted, proof);
    }

    function finalizeFor(uint256 day, address player) internal {
        ebool result = daily.getPublicResultCiphertext(day, player);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(result);
        (uint256[] memory cleartexts, bytes memory proof) = publicDecrypt(handles);
        daily.finalizeResult(day, player, cleartexts, proof);
    }

    function test_createsOneSharedPuzzleForUtcDay() public {
        uint256 day = createAndJoin();
        uint8[5] memory aliceTarget = targetFor(day, alice);
        uint8[5] memory bobTarget = targetFor(day, bob);
        uint256 sum;
        for (uint256 i; i < 5; ++i) {
            assertEq(aliceTarget[i], bobTarget[i]);
            sum += aliceTarget[i];
            for (uint256 j = i + 1; j < 5; ++j) assertTrue(aliceTarget[i] != aliceTarget[j]);
        }
        assertEq(sum, 10);

        vm.prank(carol.addr);
        vm.expectRevert("Not a daily player");
        daily.getPuzzleCiphertexts(day);
    }

    function test_dailyResultsArePublicOnlyAfterKmsProofAndRankedBySubmission() public {
        uint256 day = createAndJoin();
        submitFor(day, alice, targetFor(day, alice));
        vm.warp(block.timestamp + 1);
        submitFor(day, bob, targetFor(day, bob));

        finalizeFor(day, bob.addr);
        finalizeFor(day, alice.addr);

        ColorSnapDaily.LeaderboardEntry[] memory entries = daily.getLeaderboard(day, 0, 10);
        assertEq(entries.length, 2);
        assertEq(entries[0].player, alice.addr);
        assertEq(entries[1].player, bob.addr);

        (bool joined, bool submitted, bool finalized, bool solved,) = daily.getPlayerResult(day, alice.addr);
        assertTrue(joined && submitted && finalized && solved);
    }

    function test_unsolvedAndUnfinalizedPlayersAreExcludedFromLeaderboard() public {
        uint256 day = createAndJoin();
        uint8[5] memory wrong = [uint8(0), 0, 0, 0, 0];
        submitFor(day, alice, wrong);
        submitFor(day, bob, targetFor(day, bob));
        finalizeFor(day, alice.addr);

        ColorSnapDaily.LeaderboardEntry[] memory beforeBobFinalizes = daily.getLeaderboard(day, 0, 10);
        assertEq(beforeBobFinalizes.length, 0);

        finalizeFor(day, bob.addr);
        ColorSnapDaily.LeaderboardEntry[] memory entries = daily.getLeaderboard(day, 0, 10);
        assertEq(entries.length, 1);
        assertEq(entries[0].player, bob.addr);
    }

    function test_guardsJoinSubmissionAndFinalization() public {
        uint256 day = daily.currentDay();
        vm.prank(alice.addr);
        vm.expectRevert("Daily not created");
        daily.joinToday();

        vm.prank(alice.addr);
        daily.createToday();
        vm.prank(alice.addr);
        daily.joinToday();
        vm.prank(alice.addr);
        vm.expectRevert("Already joined");
        daily.joinToday();

        externalEuint8[5] memory emptySubmission;
        vm.prank(carol.addr);
        vm.expectRevert("Not a daily player");
        daily.submitSolution(day, emptySubmission, "");

        uint256[] memory invalid = new uint256[](1);
        invalid[0] = 1;
        vm.expectRevert("Solution not submitted");
        daily.finalizeResult(day, alice.addr, invalid, "");
    }

    function test_nextUtcDayCreatesSeparateChallengeAndClosesPriorDay() public {
        uint256 firstDay = createAndJoin();
        (bool exists, uint256 deadline, uint256 players) = daily.getDailyChallenge(firstDay);
        assertTrue(exists);
        assertEq(players, 2);

        vm.warp(deadline);
        vm.prank(carol.addr);
        uint256 secondDay = daily.createToday();
        assertEq(secondDay, firstDay + 1);

        vm.prank(carol.addr);
        daily.joinToday();
        (, , uint256 secondPlayers) = daily.getDailyChallenge(secondDay);
        assertEq(secondPlayers, 1);
    }
}
