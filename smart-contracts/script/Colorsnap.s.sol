// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {ColorSnapGame} from "../src/ColorSnapGame.sol";
import {ColorSnapChallenge} from "../src/ColorSnapChallenge.sol";
import {ColorSnapDuelEscrow} from "../src/ColorSnapDuelEscrow.sol";
import {ColorSnapDuel} from "../src/ColorSnapDuel.sol";
import {ERC7984Mock} from "@openzeppelin/confidential-contracts/mocks/token/ERC7984Mock.sol";

/// @notice Deploy script for the confidential game engine on Sepolia (FHEVM).
contract ColorSnapScript is Script {
    ColorSnapGame public game;
    ColorSnapChallenge public challenge;
    ERC7984Mock public testToken;
    ColorSnapDuelEscrow public duelEscrow;
    ColorSnapDuel public duel;
    uint64 public constant TEST_DUEL_STAKE = 1_000_000;

    function setUp() public {}

    function run() public {
        // Get deployment parameters from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("RPC_URL");
        string memory chainId = vm.envString("CHAIN_ID");

        address owner = vm.addr(deployerPrivateKey);

        console.log("=== SEPOLIA FHEVM DEPLOYMENT CONFIGURATION ===");
        console.log("Owner address:", owner);
        console.log("Chain ID:", chainId);
        console.log("RPC URL:", rpcUrl);
        console.log("===============================================");

        console.log("Deploying ColorSnapGame (confidential game engine) to Sepolia...");

        vm.startBroadcast(deployerPrivateKey);

        game = new ColorSnapGame();
        challenge = new ColorSnapChallenge();
        // ERC7984Mock deliberately leaves $_mint(address,uint64) public.
        // It is a Sepolia-only test cUSD so players can obtain funds without
        // an admin faucet or private-key dependency.
        testToken = new ERC7984Mock("ColorSnap Test USD", "cUSD", "");
        duelEscrow = new ColorSnapDuelEscrow(testToken, TEST_DUEL_STAKE);
        duel = new ColorSnapDuel(duelEscrow);
        duelEscrow.setReferee(address(duel));

        console.log("SUCCESS: ColorSnapGame deployed to:", address(game));
        console.log("SUCCESS: ColorSnapChallenge deployed to:", address(challenge));
        console.log("SUCCESS: public-mint ERC-7984 test cUSD deployed to:", address(testToken));
        console.log("SUCCESS: ColorSnapDuelEscrow deployed to:", address(duelEscrow));
        console.log("SUCCESS: ColorSnapDuel referee deployed to:", address(duel));

        vm.stopBroadcast();

        verifyContract();
    }

    function verifyContract() internal {
        string memory chainId = vm.envString("CHAIN_ID");
        string memory apiKey = vm.envString("ETHERSCAN_API_KEY");

        console.log("Starting contract verification...");
        console.log("Chain ID:", chainId);

        if (bytes(apiKey).length == 0) {
            console.log("WARNING: ETHERSCAN_API_KEY not provided, skipping verification");
            logVerificationCommand();
            return;
        }

        string[] memory inputs = buildVerificationInputs(chainId, apiKey);

        if (_runVerification(inputs)) {
            console.log("SUCCESS: Contract verified successfully!");
        } else {
            console.log("ERROR: Verification failed, see output above");
        }
    }

    /// @dev Runs the external verification command. Virtual so tests can
    /// exercise both outcomes without shelling out.
    function _runVerification(string[] memory inputs) internal virtual returns (bool) {
        try vm.ffi(inputs) {
            return true;
        } catch {
            return false;
        }
    }

    /// @notice Builds the `forge verify-contract` invocation. Exposed separately
    /// so the command can be asserted without shelling out to FFI.
    function buildVerificationInputs(string memory chainId, string memory apiKey)
        public
        view
        returns (string[] memory inputs)
    {
        inputs = new string[](8);
        inputs[0] = "forge";
        inputs[1] = "verify-contract";
        inputs[2] = vm.toString(address(game));
        inputs[3] = "src/ColorSnapGame.sol:ColorSnapGame";
        inputs[4] = "--chain-id";
        inputs[5] = chainId;
        inputs[6] = "--etherscan-api-key";
        inputs[7] = apiKey;
    }

    function logVerificationCommand() internal view {
        console.log("");
        console.log("=== MANUAL VERIFICATION COMMAND ===");
        console.log("Contract Address:", address(game));
        console.log("Contract Path: src/ColorSnapGame.sol:ColorSnapGame");
        console.log("Chain ID: 11155111");
        console.log("API Key: $ETHERSCAN_API_KEY");
        console.log("");
        console.log("Manual verification command:");
        console.log(
            "forge verify-contract [CONTRACT_ADDRESS] src/ColorSnapGame.sol:ColorSnapGame --chain-id 11155111 --etherscan-api-key [API_KEY]"
        );
        console.log("===================================");
    }
}
