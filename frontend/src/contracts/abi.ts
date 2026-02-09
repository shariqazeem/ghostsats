/** Minimal ABI fragments for contract interactions. */

export const ERC20_ABI = [
  {
    name: "mint",
    type: "function",
    inputs: [
      { name: "to", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    name: "balance_of",
    type: "function",
    inputs: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

export const SHIELDED_POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_pending_usdc",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "get_batch_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_current_batch_id",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [
      { name: "amount", type: "core::integer::u256" },
      { name: "secret", type: "core::felt252" },
      { name: "blinder", type: "core::felt252" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_batch_result",
    type: "function",
    inputs: [
      { name: "batch_id", type: "core::integer::u64" },
    ],
    outputs: [
      { type: "ghost_sats::BatchResult" },
    ],
    state_mutability: "view",
  },
  {
    name: "is_nullifier_spent",
    type: "function",
    inputs: [
      { name: "nullifier", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
] as const;
