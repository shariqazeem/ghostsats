/**
 * Bitcoin wallet utilities for GhostSats.
 * Uses sats-connect (Xverse) to request a message signature
 * proving the user authorizes a deposit from their BTC identity.
 */

export async function signBitcoinIntent(btcAddress: string): Promise<string> {
  const { signMessage, BitcoinNetworkType } = await import("sats-connect");

  return new Promise<string>((resolve, reject) => {
    signMessage({
      payload: {
        address: btcAddress,
        message: `Authorize GhostSats Deposit from ${btcAddress}`,
        network: { type: BitcoinNetworkType.Testnet4 },
      },
      onFinish: (signature) => {
        resolve(signature);
      },
      onCancel: () => {
        reject(new Error("User cancelled Bitcoin signature"));
      },
    });
  });
}
