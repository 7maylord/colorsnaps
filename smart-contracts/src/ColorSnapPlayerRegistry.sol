// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Public player callsigns keyed by the wallet that owns them.
/// @dev Names are presentation only. Game results remain keyed by address.
contract ColorSnapPlayerRegistry {
    mapping(address => string) public names;

    event NameChanged(address indexed player, string name);

    function setName(string calldata name) external {
        bytes memory value = bytes(name);
        require(value.length >= 2 && value.length <= 20, "Name length must be 2-20");
        require(value[0] != 0x20 && value[value.length - 1] != 0x20, "No edge spaces");

        for (uint256 i; i < value.length; ++i) {
            bytes1 c = value[i];
            require(
                (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)
                    || c == 0x20 || c == 0x5f || c == 0x2d,
                "Use letters, numbers, spaces, _ or -"
            );
            if (i > 0) require(c != 0x20 || value[i - 1] != 0x20, "No repeated spaces");
        }

        names[msg.sender] = name;
        emit NameChanged(msg.sender, name);
    }
}
