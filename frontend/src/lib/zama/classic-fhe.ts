"use client";

import { sepolia } from "@fhevm/sdk/chains";
import { createFhevmClient, initFhevmRuntime, setFhevmRuntimeConfig } from "@fhevm/sdk/viem";
import type { Hex, PublicClient, WalletClient } from "viem";

const PUZZLE_SIZE = 5;
// The SDK only accepts whole-day permit durations.
const PERMIT_DURATION_SECONDS = 24 * 60 * 60;
let runtimeReady: Promise<void> | undefined;

export function prepareFhevmRuntime(): Promise<void> {
  if (typeof window === "undefined") throw new Error("FHE encryption must run in the browser.");
  setFhevmRuntimeConfig({ wasmAssetLoadMode: "auto" });
  runtimeReady ??= initFhevmRuntime().catch((error) => {
    runtimeReady = undefined;
    throw error;
  });
  return runtimeReady;
}

export type EncryptedClassicSubmission = {
  readonly handles: readonly [Hex, Hex, Hex, Hex, Hex];
  readonly inputProof: Hex;
};

export async function encryptStake(parameters: {
  readonly publicClient: PublicClient;
  readonly tokenAddress: Hex;
  readonly playerAddress: Hex;
  readonly amount: bigint;
}): Promise<{ readonly handle: Hex; readonly inputProof: Hex }> {
  const fhevm = await createClassicFheClient(parameters.publicClient);
  const result = await fhevm.encryptValues({
    contractAddress: parameters.tokenAddress,
    userAddress: parameters.playerAddress,
    values: [{ type: "uint64", value: parameters.amount }],
  });
  if (result.encryptedValues.length !== 1) throw new Error("The FHE relayer returned an invalid stake input.");
  return { handle: result.encryptedValues[0] as Hex, inputProof: result.inputProof as Hex };
}

function assertPuzzle(values: readonly number[]): asserts values is readonly [number, number, number, number, number] {
  if (values.length !== PUZZLE_SIZE || values.some((value) => !Number.isInteger(value) || value < 0 || value >= PUZZLE_SIZE)) {
    throw new Error("A ColorSnap solution must contain five bottle identifiers from 0 through 4.");
  }
}

/**
 * Browser-only FHE boundary for the Classic contract. The FHEVM SDK never
 * receives a private key: it asks the connected wallet to sign the scoped
 * user-decryption permit.
 */
export async function createClassicFheClient(publicClient: PublicClient) {
  await prepareFhevmRuntime();
  // The app's wagmi stack currently pins an older compatible viem minor than
  // the FHEVM SDK's own viem dependency. Both expose the public-client methods
  // required by the SDK; avoid leaking its internal generic version into app
  // types until the wallet stack is upgraded together.
  const fhevm = createFhevmClient({ publicClient: publicClient as never, chain: sepolia });
  await fhevm.ready;
  return fhevm;
}

export async function encryptClassicSolution(parameters: {
  readonly publicClient: PublicClient;
  readonly contractAddress: Hex;
  readonly playerAddress: Hex;
  readonly bottleIds: readonly number[];
}): Promise<EncryptedClassicSubmission> {
  const { publicClient, contractAddress, playerAddress, bottleIds } = parameters;
  assertPuzzle(bottleIds);
  const fhevm = await createClassicFheClient(publicClient);
  const encrypted = await fhevm.encryptValues({
    contractAddress,
    userAddress: playerAddress,
    values: bottleIds.map((value) => ({ type: "uint8", value })),
  });

  if (encrypted.encryptedValues.length !== PUZZLE_SIZE) {
    throw new Error("The FHE relayer returned an invalid ColorSnap input bundle.");
  }

  return {
    handles: encrypted.encryptedValues as unknown as readonly [Hex, Hex, Hex, Hex, Hex],
    inputProof: encrypted.inputProof as Hex,
  };
}

export async function encryptArcadeSolution(parameters: {
  readonly publicClient: PublicClient;
  readonly contractAddress: Hex;
  readonly playerAddress: Hex;
  readonly bottleIds: readonly number[];
}): Promise<{ readonly handles: readonly Hex[]; readonly inputProof: Hex }> {
  const { publicClient, contractAddress, playerAddress, bottleIds } = parameters;
  if (bottleIds.length < 5 || bottleIds.length > 7 || new Set(bottleIds).size !== bottleIds.length ||
      bottleIds.some((id) => !Number.isInteger(id) || id < 0 || id >= bottleIds.length)) {
    throw new Error("The Classic arrangement must contain each bottle exactly once.");
  }
  const fhevm = await createClassicFheClient(publicClient);
  const encrypted = await fhevm.encryptValues({
    contractAddress,
    userAddress: playerAddress,
    values: bottleIds.map((value) => ({ type: "uint8", value })),
  });
  if (encrypted.encryptedValues.length !== bottleIds.length) throw new Error("The FHE relayer returned an incomplete Classic input.");
  return { handles: encrypted.encryptedValues as unknown as readonly Hex[], inputProof: encrypted.inputProof as Hex };
}

export async function decryptClassicValues(parameters: {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly playerAddress: Hex;
  readonly contractAddress: Hex;
  readonly ciphertexts: readonly Hex[];
}): Promise<readonly number[]> {
  const { publicClient, walletClient, playerAddress, contractAddress, ciphertexts } = parameters;
  if (ciphertexts.length === 0) throw new Error("No encrypted values were provided for decryption.");

  const fhevm = await createClassicFheClient(publicClient);
  const transportKeyPair = await fhevm.generateTransportKeyPair();
  const signedPermit = await fhevm.signDecryptionPermit({
    contractAddresses: [contractAddress],
    startTimestamp: Math.floor(Date.now() / 1000),
    durationSeconds: PERMIT_DURATION_SECONDS,
    signerAddress: playerAddress,
    signer: walletClient,
    transportKeyPair,
  });
  const values = await fhevm.decryptValues({
    encryptedValues: ciphertexts,
    contractAddress,
    transportKeyPair,
    signedPermit,
  });

  return values.map(({ type, value }) => {
    if (type !== "uint8" || typeof value !== "number") {
      throw new Error("The FHE relayer returned an unexpected ColorSnap cleartext type.");
    }
    return value;
  });
}

export async function decryptClassicBoolean(parameters: {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly playerAddress: Hex;
  readonly contractAddress: Hex;
  readonly ciphertext: Hex;
}): Promise<boolean> {
  const { publicClient, walletClient, playerAddress, contractAddress, ciphertext } = parameters;
  const fhevm = await createClassicFheClient(publicClient);
  const transportKeyPair = await fhevm.generateTransportKeyPair();
  const signedPermit = await fhevm.signDecryptionPermit({
    contractAddresses: [contractAddress],
    startTimestamp: Math.floor(Date.now() / 1000),
    durationSeconds: PERMIT_DURATION_SECONDS,
    signerAddress: playerAddress,
    signer: walletClient,
    transportKeyPair,
  });
  const value = await fhevm.decryptValue({
    encryptedValue: ciphertext,
    contractAddress,
    transportKeyPair,
    signedPermit,
  });
  if (value.type !== "bool" || typeof value.value !== "boolean") {
    throw new Error("The FHE relayer returned an unexpected ColorSnap result type.");
  }
  return value.value;
}

/**
 * Fetches a publicly decryptable win/loss result and the KMS proof that the
 * challenge contract requires before it records that result. No wallet permit
 * is needed: the contract has deliberately made this single boolean public.
 */
export async function decryptPublicBooleanWithProof(parameters: {
  readonly publicClient: PublicClient;
  readonly ciphertext: Hex;
}): Promise<{ readonly cleartexts: readonly [bigint]; readonly solved: boolean; readonly decryptionProof: Hex }> {
  const fhevm = await createClassicFheClient(parameters.publicClient);
  const result = await fhevm.decryptPublicValuesWithSignatures({ encryptedValues: [parameters.ciphertext] });
  const value = result.clearValues[0];
  if (value.type !== "bool" || typeof value.value !== "boolean") {
    throw new Error("The FHE relayer returned an unexpected public result type.");
  }
  return {
    cleartexts: [BigInt(value.value ? 1 : 0)],
    solved: value.value,
    decryptionProof: result.checkSignaturesArgs.decryptionProof as Hex,
  };
}
