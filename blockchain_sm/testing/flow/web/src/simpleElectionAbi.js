export const electionV1Abi = [
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
];
