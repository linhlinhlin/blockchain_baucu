export const electionAbi = [
  {
    type: "function",
    name: "currentPhase",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "enum ElectionV1.Phase" }],
  },
  {
    type: "function",
    name: "computeCommitment",
    stateMutability: "view",
    inputs: [
      { name: "voter", type: "address", internalType: "address" },
      { name: "candidateId", type: "bytes32", internalType: "bytes32" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "function",
    name: "commitVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "commitment", type: "bytes32", internalType: "bytes32" },
      { name: "proof", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "candidateId", type: "bytes32", internalType: "bytes32" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeElection",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "commitments",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address", internalType: "address" }],
    outputs: [{ name: "commitment", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "function",
    name: "hasRevealed",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address", internalType: "address" }],
    outputs: [{ name: "revealed", type: "bool", internalType: "bool" }],
  },
];
