// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {FHE, ebool, euint8, euint64, externalEuint8, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";
import {ERC7984Mock} from "@openzeppelin/confidential-contracts/mocks/token/ERC7984Mock.sol";
import {ColorSnapDuelEscrow} from "../src/ColorSnapDuelEscrow.sol";
import {ColorSnapDuel} from "../src/ColorSnapDuel.sol";

contract ColorSnapDuelTest is FhevmTest {
    ERC7984Mock token;
    ColorSnapDuelEscrow escrow;
    ColorSnapDuel duel;
    Account alice;
    Account bob;
    uint256 nonce;

    function setUp() public override {
        super.setUp();
        alice = makeAccount("alice");
        bob = makeAccount("bob");
        token = new ERC7984Mock("cUSD", "cUSD", "");
        escrow = new ColorSnapDuelEscrow(token, 100);
        duel = new ColorSnapDuel(escrow);
        escrow.setReferee(address(duel));
        token.$_mint(alice.addr, 200);
        token.$_mint(bob.addr, 200);
    }

    function deposit(uint256 id, Account memory p) internal {
        (externalEuint64 a, bytes memory pr) = encryptUint64(100, p.addr, address(token));
        vm.prank(p.addr);
        token.confidentialTransferAndCall(address(escrow), a, pr, abi.encode(id));
        ebool ok = escrow.getDepositMatchCiphertext(id, p.addr);
        bytes32[] memory h = new bytes32[](1);
        h[0] = FHE.toBytes32(ok);
        (uint256[] memory c, bytes memory proof) = publicDecrypt(h);
        escrow.finalizeDeposit(id, p.addr, c, proof);
    }

    function inputs(uint8[5] memory v, address user)
        internal
        returns (externalEuint8[5] memory out, bytes memory proof)
    {
        bytes32[] memory h = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            ++nonce;
            bytes memory c = abi.encodePacked(keccak256(abi.encodePacked(v[i], uint8(FheType.Uint8), nonce)));
            h[i] = InputProofHelper.computeInputHandle(c, uint8(i), FheType.Uint8, aclAdd, uint64(block.chainid));
            _plaintexts[h[i]] = v[i];
            out[i] = externalEuint8.wrap(h[i]);
        }
        bytes32 d = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest =
            InputProofHelper.computeInputVerificationDigest(h, user, address(duel), block.chainid, EMPTY_EXTRA_DATA, d);
        bytes[] memory s = new bytes[](1);
        s[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        proof = InputProofHelper.assembleInputProof(h, s, EMPTY_EXTRA_DATA);
    }

    function target(uint256 id, Account memory p) internal returns (uint8[5] memory v) {
        vm.prank(p.addr);
        euint8[5] memory x = duel.getPuzzleCiphertexts(id);
        for (uint256 i; i < 5; ++i) {
            v[i] = uint8(userDecrypt(FHE.toBytes32(x[i]), p.addr, address(duel), signUserDecrypt(p.key, address(duel))));
        }
    }

    function finalize(uint256 id, address p) internal {
        ebool x = duel.getPublicResultCiphertext(id, p);
        bytes32[] memory h = new bytes32[](1);
        h[0] = FHE.toBytes32(x);
        (uint256[] memory c, bytes memory pr) = publicDecrypt(h);
        duel.finalizeResult(id, p, c, pr);
    }

    function test_fundedDuelVerifiesAndSettlesWinner() public {
        vm.prank(alice.addr);
        uint256 id = escrow.createDuel(bob.addr);
        deposit(id, alice);
        deposit(id, bob);
        duel.startDuel(id);
        uint8[5] memory a = target(id, alice);
        (externalEuint8[5] memory x, bytes memory pr) = inputs(a, alice.addr);
        vm.prank(alice.addr);
        duel.submitSolution(id, x, pr);
        uint8[5] memory wrong = [uint8(0), 0, 0, 0, 0];
        (x, pr) = inputs(wrong, bob.addr);
        vm.prank(bob.addr);
        duel.submitSolution(id, x, pr);
        finalize(id, alice.addr);
        finalize(id, bob.addr);
        duel.resolveDuel(id);
        euint64 b = token.confidentialBalanceOf(alice.addr);
        assertEq(
            userDecrypt(FHE.toBytes32(b), alice.addr, address(token), signUserDecrypt(alice.key, address(token))), 300
        );
    }
}
