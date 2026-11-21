// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {ColorSnapGame} from "../src/ColorSnapGame.sol";
import {ColorSnapChallenge} from "../src/ColorSnapChallenge.sol";

/// @notice Deploy script for the confidential game engine on Sepolia (FHEVM).
contract ColorSnapScript is Script {
    ColorSnapGame public game;
    ColorSnapChallenge public challenge;

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

        console.log("SUCCESS: ColorSnapGame deployed to:", address(game));
        console.log("SUCCESS: ColorSnapChallenge deployed to:", address(challenge));

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

        string[] memory inputs = new string[](8);
        inputs[0] = "forge";
        inputs[1] = "verify-contract";
        inputs[2] = vm.toString(address(game));
        inputs[3] = "src/ColorSnapGame.sol:ColorSnapGame";
        inputs[4] = "--chain-id";
        inputs[5] = chainId;
        inputs[6] = "--etherscan-api-key";
        inputs[7] = apiKey;

        try vm.ffi(inputs) {
            console.log("SUCCESS: Contract verified successfully!");
        } catch {
            console.log("ERROR: Verification failed, see output above");
        }
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
