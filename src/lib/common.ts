import { Account, Keypair, SorobanRpc, StrKey } from "@stellar/stellar-sdk/minimal"
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";

export const rpc = new SorobanRpc.Server(import.meta.env.PUBLIC_RPC_URL);

export const mockPubkey = StrKey.encodeEd25519PublicKey(Buffer.alloc(32))
export const mockSource = new Account(mockPubkey, '0')

export const fundKeypair = new Promise<Keypair>(async (resolve) => {
    const now = new Date();

    now.setMinutes(0, 0, 0);

    const nowData = new TextEncoder().encode(now.getTime().toString());
    const hashBuffer = await crypto.subtle.digest('SHA-256', nowData);
    const keypair = Keypair.fromSecret("SBEIDWQVWNLPCP35EYQ6GLWKFQ2MDY7APRLOQ3AJNU6KSE7FXGA7C55W");
    const publicKey = keypair.publicKey()

    await rpc.getAccount(publicKey)
        .catch(() => rpc.requestAirdrop(publicKey))
        .catch(() => { })

    await resolve(keypair)
})
export const fundPubkey = (await fundKeypair).publicKey()
export const fundSigner = basicNodeSigner(await fundKeypair, import.meta.env.PUBLIC_PASSPHRASE)