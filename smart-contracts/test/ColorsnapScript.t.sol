// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ColorSnapScript} from "../script/Colorsnap.s.sol";

/// @notice Script harness that records verification outcomes instead of
/// shelling out through FFI.
contract ColorSnapScriptHarness is ColorSnapScript {
    bool internal verificationResult = true;

    function setVerificationResult(bool value) external {
        verificationResult = value;
    }

    function _runVerification(string[] memory) internal override returns (bool) {
        return verificationResult;
    }
}

/// @notice Exercises the deployment script's local broadcast and verification
/// branches. Environment values are changed inside a single test so parallel
/// test execution cannot observe half-updated configuration.
contract ColorSnapScriptTest is Test {
    uint256 internal constant DEPLOYER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function setUp() public {
        vm.setEnv("PRIVATE_KEY", vm.toString(DEPLOYER_PK));
        vm.setEnv("RPC_URL", "http://127.0.0.1:8545");
        vm.setEnv("CHAIN_ID", "11155111");
    }

    function test_buildVerificationInputsTargetsGame() public {
        ColorSnapScript script = new ColorSnapScript();
        script.setUp();

        string[] memory inputs = script.buildVerificationInputs("11155111", "dummy-key");

        assertEq(inputs.length, 10);
        assertEq(inputs[0], "forge");
        assertEq(inputs[1], "verify-contract");
        assertEq(inputs[2], vm.toString(address(script.game())));
        assertEq(inputs[3], "src/ColorSnapGame.sol:ColorSnapGame");
        assertEq(inputs[4], "--verifier");
        assertEq(inputs[5], "etherscan");
        assertEq(inputs[6], "--chain");
        assertEq(inputs[7], "11155111");
        assertEq(inputs[8], "--etherscan-api-key");
        assertEq(inputs[9], "dummy-key");
    }

    function test_runHandlesVerificationConfiguration() public {
        // No API key: skip verification and print the manual command.
        vm.setEnv("ETHERSCAN_API_KEY", "");
        ColorSnapScript skipped = new ColorSnapScript();
        skipped.run();
        assertTrue(address(skipped.game()) != address(0));
        assertTrue(address(skipped.challenge()) != address(0));
        assertTrue(address(skipped.daily()) != address(0));
        assertTrue(address(skipped.testToken()) != address(0));
        assertTrue(address(skipped.duelEscrow()) != address(0));
        assertTrue(address(skipped.duel()) != address(0));
        assertEq(skipped.duelEscrow().referee(), address(skipped.duel()));

        // Non-empty key: the base script attempts FFI, which is disabled in
        // tests, so the failure path is exercised.
        vm.setEnv("ETHERSCAN_API_KEY", "dummy-key");
        ColorSnapScript attempted = new ColorSnapScript();
        attempted.run();
        assertTrue(address(attempted.game()) != address(0));

        // Harnessed success and failure paths without external commands.
        ColorSnapScriptHarness verified = new ColorSnapScriptHarness();
        verified.run();
        assertTrue(address(verified.game()) != address(0));

        ColorSnapScriptHarness failed = new ColorSnapScriptHarness();
        failed.setVerificationResult(false);
        failed.run();
        assertTrue(address(failed.game()) != address(0));
    }
}
