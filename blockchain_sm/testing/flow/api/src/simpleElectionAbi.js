module.exports = [
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "enum SimpleElectionFlow.Status" }],
  },
  {
    type: "function",
    name: "totalVotes",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "votedCandidateIndexPlusOne",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "getResults",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "candidateIds", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "candidateNames", type: "string[]", internalType: "string[]" },
      { name: "candidateWallets", type: "address[]", internalType: "address[]" },
      { name: "counts", type: "uint256[]", internalType: "uint256[]" },
    ],
  },
  {
    anonymous: false,
    type: "event",
    name: "VoteCast",
    inputs: [
      { indexed: true, name: "voter", type: "address", internalType: "address" },
      { indexed: true, name: "candidateIndex", type: "uint256", internalType: "uint256" },
      { indexed: true, name: "candidateId", type: "bytes32", internalType: "bytes32" },
      { indexed: false, name: "candidateName", type: "string", internalType: "string" },
      {
        indexed: false,
        name: "candidateWalletAddress",
        type: "address",
        internalType: "address"
      },
      { indexed: false, name: "timestamp", type: "uint256", internalType: "uint256" }
    ],
  },
];
