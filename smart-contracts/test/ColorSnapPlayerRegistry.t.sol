// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ColorSnapPlayerRegistry} from "../src/ColorSnapPlayerRegistry.sol";

contract ColorSnapPlayerRegistryTest is Test {
    ColorSnapPlayerRegistry registry;

    function setUp() public { registry = new ColorSnapPlayerRegistry(); }

    function testWalletOwnsAndCanChangeName() public {
        vm.prank(address(0xA11CE)); registry.setName("Color Star");
        assertEq(registry.names(address(0xA11CE)), "Color Star");
        assertEq(registry.names(address(0xB0B)), "");
        vm.prank(address(0xA11CE)); registry.setName("Snap_2");
        assertEq(registry.names(address(0xA11CE)), "Snap_2");
    }

    function testRejectsInvalidNames() public {
        vm.expectRevert("Name length must be 2-20"); registry.setName("A");
        vm.expectRevert("Name length must be 2-20"); registry.setName("ABCDEFGHIJKLMNOPQRSTU");
        vm.expectRevert("No edge spaces"); registry.setName(" Alice");
        vm.expectRevert("No repeated spaces"); registry.setName("Alice  Bob");
        vm.expectRevert("Use letters, numbers, spaces, _ or -"); registry.setName("Alice! <b>");
    }
}
