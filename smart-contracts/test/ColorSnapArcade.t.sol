// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {ColorSnapArcade, IColorSnapDailyResults} from "../src/ColorSnapArcade.sol";
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";

contract DailyResultStub is IColorSnapDailyResults {
    mapping(uint256 => mapping(address => bool)) public wins;
    function setWin(uint256 day, address player) external { wins[day][player] = true; }
    function getPlayerResult(uint256 day, address player) external view returns (bool, bool, bool, bool, uint256) {
        bool win = wins[day][player]; return (win, win, win, win, 0);
    }
}

contract ColorSnapArcadeTest is FhevmTest {
    using stdStorage for StdStorage;
    ColorSnapArcade internal arcade;
    DailyResultStub internal daily;
    Account internal alice;
    Account internal bob;
    uint256 private nonce;

    function setUp() public override {
        super.setUp();
        daily = new DailyResultStub();
        arcade = new ColorSnapArcade(daily);
        alice = makeAccount("alice");
        bob = makeAccount("bob");
    }

    function create() internal returns (uint256 id) { vm.prank(alice.addr); id = arcade.createClassicGame(); }

    function target(uint256 id) internal returns (uint8[] memory ids) {
        vm.prank(alice.addr);
        euint8[] memory handles = arcade.getPuzzleCiphertexts(id);
        ids = new uint8[](handles.length);
        for (uint256 i; i < handles.length; ++i) {
            ids[i] = uint8(userDecrypt(FHE.toBytes32(handles[i]), alice.addr, address(arcade), signUserDecrypt(alice.key, address(arcade))));
        }
    }

    function submit(uint256 id, uint8[] memory values) internal {
        bytes32[] memory handles = new bytes32[](values.length);
        externalEuint8[] memory inputs = new externalEuint8[](values.length);
        for (uint256 i; i < values.length; ++i) {
            ++nonce;
            bytes memory ciphertext = abi.encodePacked(keccak256(abi.encodePacked(values[i], uint8(FheType.Uint8), nonce)));
            handles[i] = InputProofHelper.computeInputHandle(ciphertext, uint8(i), FheType.Uint8, aclAdd, uint64(block.chainid));
            _plaintexts[handles[i]] = values[i];
            inputs[i] = externalEuint8.wrap(handles[i]);
        }
        bytes32 domain = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest = InputProofHelper.computeInputVerificationDigest(handles, alice.addr, address(arcade), block.chainid, EMPTY_EXTRA_DATA, domain);
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        bytes memory proof = InputProofHelper.assembleInputProof(handles, signatures, EMPTY_EXTRA_DATA);
        vm.prank(alice.addr); arcade.submitSolution(id, inputs, proof);
    }

    function finalize(uint256 id) internal {
        ebool result = arcade.getPublicResultCiphertext(id);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(result);
        (uint256[] memory cleartexts, bytes memory proof) = publicDecrypt(handles);
        arcade.finalizeResult(id, cleartexts, proof);
    }

    function testVerifiedClassicPointsAndProgression() public {
        assertEq(arcade.nextPuzzleSize(alice.addr), 5);
        for (uint256 n; n < 10; ++n) {
            uint256 id = create();
            uint8[] memory solution = target(id);
            assertEq(solution.length, 5);
            submit(id, solution);
            finalize(id);
        }
        assertEq(arcade.points(alice.addr), 100);
        assertEq(arcade.completedGames(alice.addr), 10);
        assertEq(arcade.nextPuzzleSize(alice.addr), 6);
        uint256 next = create();
        uint8[] memory six = target(next);
        assertEq(six.length, 6);
        uint256 sum;
        for (uint256 i; i < six.length; ++i) sum += six[i];
        assertEq(sum, 15);
    }

    function testWrongSolutionAdvancesWithoutPointsAndProofCannotReplay() public {
        uint256 id = create();
        uint8[] memory wrong = new uint8[](5);
        submit(id, wrong);
        finalize(id);
        assertEq(arcade.completedGames(alice.addr), 1);
        assertEq(arcade.points(alice.addr), 0);
        vm.expectRevert("Already finalized or unavailable"); arcade.finalizeResult(id, new uint256[](1), "");
    }

    function testSevenBottlesAfterThirtyFinalizedGames() public {
        stdstore.target(address(arcade)).sig("completedGames(address)").with_key(alice.addr).checked_write(30);
        assertEq(arcade.completedGames(alice.addr), 30);
        assertEq(arcade.nextPuzzleSize(alice.addr), 7);
        uint256 id = create();
        uint8[] memory seven = target(id);
        assertEq(seven.length, 7);
        uint256 sum;
        for (uint256 i; i < seven.length; ++i) sum += seven[i];
        assertEq(sum, 21);
    }

    function testDailyClaimRequiresVerifiedWinAndCannotReplay() public {
        vm.prank(alice.addr); vm.expectRevert("No verified Daily win"); arcade.claimDaily(1);
        daily.setWin(1, alice.addr);
        vm.prank(alice.addr); arcade.claimDaily(1);
        assertEq(arcade.points(alice.addr), 20);
        vm.prank(alice.addr); vm.expectRevert("Daily already claimed"); arcade.claimDaily(1);
        ColorSnapArcade.LeaderboardEntry[] memory ranks = arcade.getLeaderboard(0, 10);
        assertEq(ranks.length, 1);
        assertEq(ranks[0].points, 20);
    }

    function testLeaderboardSortsDailyAboveClassicAndPaginates() public {
        uint256 id = create();
        submit(id, target(id));
        finalize(id);
        daily.setWin(2, bob.addr);
        vm.prank(bob.addr); arcade.claimDaily(2);

        ColorSnapArcade.LeaderboardEntry[] memory first = arcade.getLeaderboard(0, 1);
        assertEq(first.length, 1);
        assertEq(first[0].player, bob.addr);
        assertEq(first[0].points, 20);

        ColorSnapArcade.LeaderboardEntry[] memory second = arcade.getLeaderboard(1, 1);
        assertEq(second.length, 1);
        assertEq(second[0].player, alice.addr);
        assertEq(second[0].points, 10);
        assertEq(second[0].completedGames, 1);
    }
}
