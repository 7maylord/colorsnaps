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
    ],
  },
] as const;

export const colorSnapChallengeAbi = [
  {
    type: "function",
    name: "createChallenge",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "challengeId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinChallenge",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPuzzleCiphertexts",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[5]" }],
  },
  {
    type: "function",
    name: "submitSolution",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "submitted", type: "bytes32[5]" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPublicResultCiphertext",
    stateMutability: "view",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "finalizeResult",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "player", type: "address" },
      { name: "cleartexts", type: "uint256[]" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveChallenge",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "ChallengeCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "challengeId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
    ],
  },
] as const;
