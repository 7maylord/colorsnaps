export const colorSnapFheAbi = [
  {
    type: "function",
    name: "createClassicGame",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPuzzleCiphertexts",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[5]" }],
  },
  {
    type: "function",
    name: "submitSolution",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "submitted", type: "bytes32[5]" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getSolutionResult",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "endGame",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "GameCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "deadline", type: "uint256" },
    ],
  },
] as const;
