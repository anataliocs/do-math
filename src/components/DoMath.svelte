<script lang="ts">
    import { onMount } from "svelte";
    import {
        xdr,
        scValToNative,
        Keypair,
        Address,
    } from "@stellar/stellar-sdk/minimal";
    import { Client, networks } from "do-math-sdk";
    import {
        PasskeyServer,
        PasskeyKit,
        SACClient,
        SignerStore,
        PasskeyClient,
        type SignerLimits,
        SignerKey,
    } from "passkey-kit";
    import { fundPubkey, fundSigner } from "../lib/common";
    import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";

    let url: URL;

    const pk_server = new PasskeyServer({
        rpcUrl: import.meta.env.PUBLIC_RPC_URL,
        launchtubeUrl: import.meta.env.PUBLIC_LAUNCHTUBE_URL,
        launchtubeJwt: import.meta.env.PUBLIC_LAUNCHTUBE_JWT,
        mercuryUrl: import.meta.env.PUBLIC_MERCURY_URL,
        mercuryJwt: import.meta.env.PUBLIC_MERCURY_JWT,
    });

    const pk_wallet = new PasskeyKit({
        rpcUrl: import.meta.env.PUBLIC_RPC_URL,
        networkPassphrase: import.meta.env.PUBLIC_PASSPHRASE,
        factoryContractId: import.meta.env.PUBLIC_FACTORY,
    });

    // Client that uses sac-sdk to interact
    //with Soroban smart contracts
    const sac = new SACClient({
        // Public RPC node
        rpcUrl: import.meta.env.PUBLIC_RPC_URL,
        // Network passphrase for testnet Stellar network
        networkPassphrase: import.meta.env.PUBLIC_PASSPHRASE,
    });

    //Generated typescript bindings for deployed math client
    const mathContract = new Client({
        rpcUrl: import.meta.env.PUBLIC_RPC_URL,
        // Our deployed DO MATH smart contract
        contractId: import.meta.env.PUBLIC_DO_MATH,
        networkPassphrase: import.meta.env.PUBLIC_PASSPHRASE,
    });

    const native = sac.getSACClient(import.meta.env.PUBLIC_NATIVE);

    let keypair: Keypair;
    let keyId_: string;
    let contractId_: string;

    let a: number;
    let b: number;

    let loading: Map<string, boolean> = new Map();

    // Lifecycle hook that schedules a callback that runs when
    // the component is mounted in the DOM
    onMount(() => {
        url = new URL(location.href);

        // Checks for a URL search parameter in the form ?keyId=
        const keyId = url.searchParams.get("keyId") || undefined;
        const contractId = url.searchParams.get("contractId") || undefined;
        const secret = url.searchParams.get("secret");

        // If key ID is found
        if (keyId) {
            // Call async function connectWallet
            // Then attach callback to execute fundWallet function
            // Upon successful execution
            console.log("Connecting Wallet...");
            console.log(keyId);
            connectWallet(keyId).then(() => console.log("Wallet Connected"));
        }

        if (secret) {
            keypair = Keypair.fromSecret(secret);
            console.log(keypair.publicKey());
        } else {
            keypair = Keypair.random();
            url.searchParams.set("secret", keypair.secret());
            history.pushState({}, "", url);
        }

        refresh();
    });

    // Function called when create wallet button is clicked
    async function createWallet() {
        try {
            // Set loading icon on button
            loading.set("createWallet", true);
            loading = loading;

            //Prompt for wallet name
            let walletName: string = prompt("Wallet Name?") || "Default Wallet";

            console.log("Creating Wallet");
            const { keyId, keyId_base64, contractId, built } =
                // Call the create wallet function on the passkeys
                // kit object we configured earlier
                // Passing in the app and user names
                await pk_wallet.createWallet(
                    walletName,
                    "Chris Anatalio"
                );

            keyId_ = keyId_base64;

            // Built is the assembled transaction
            console.log("Built Create Wallet Transaction");
            console.log(built);

            // User the passkeys server to send the create wallet
            // transaction
            console.log("Sending Transaction");
            await pk_server.send(built)
            .then((res) => console.log(res));

            url.searchParams.set("keyId", keyId_);
            history.pushState({}, "", url);

            contractId_ = contractId;

            // Then fund the wallet
            fundWallet();
        } finally {
            loading.set("createWallet", false);
            loading = loading;
        }
    }

    // Function to sign into existing smart wallet with Passkey
    async function signIn() {
        try {
            //Set loading icon
            loading.set("signIn", true);
            loading = loading;

            // Prompt for the key id
            // Or close this window and a menu of existing passkeys
            // will pop up
            let existingKeyId: string = prompt("What is your key id?") || "";
            console.log(existingKeyId);

            // Connect to the existing passkey wallet
            console.log("Connecting Wallet");
            const { keyId_base64, contractId } = await pk_wallet.connectWallet({
                keyId: existingKeyId,
            });

            console.log("Wallet Contract ID");
            console.log(contractId);

            keyId_ = keyId_base64;

            // Update params and refresh
            url.searchParams.set("keyId", keyId_);
            url.searchParams.set("contractId", contractId);
            history.pushState({}, "", url);
            refresh();

            contractId_ = contractId;
        } catch (err: any) {
            console.log(err);
        } finally {
            loading.set("signIn", false);
            loading = loading;
        }
    }

    async function connectWallet(keyId: string) {
        console.log("Connecting Wallet");
        const { keyId_base64, contractId } = await pk_wallet.connectWallet({
            keyId,
        });

        keyId_ = keyId_base64;

        if (!keyId) {
            url.searchParams.set("keyId", keyId_);
            history.pushState({}, "", url);
        }

        console.log("PasskeyClient Wallet");
        console.log(pk_wallet.wallet);

        contractId_ = contractId;
    }

    // Invokes deployed smart contract and signs with passkey
    async function doMath() {
        try {
            loading.set("doMath", true);
            loading = loading;

            console.log("Creating Transaction");

            // Invoke deployed smart contract
            const at = await mathContract.do_math({
                source: contractId_,
                a: BigInt(a),
                b: BigInt(b),
            });

            console.log("Function Invocation Transaction");
            console.log(at);

            // Sign transaction with passkey
            console.log("Signing Transaction");
            await pk_wallet
                .sign(at, { keyId: keyId_ })
                .catch((err) => console.log(err));

            console.log("Transaction After Signing");
            console.log(at);

            console.log("Invoking Contract");

            // Send transaction using passkeys server and launchtube
            console.log("Sending Transaction");
            const res = await pk_server
                .send(at.built!)
                .catch((err) => console.log(err));

            console.log("Transaction Response");
            console.log(res);

            // Parse transaction response
            const meta = xdr.TransactionMeta.fromXDR(
                res.resultMetaXdr,
                "base64",
            );
            const result = scValToNative(
                meta.v3().sorobanMeta()!.returnValue(),
            );

            console.log("Invoked Smart Contract Function Result");
            console.log(`${a} + ${b} = ${result}`);

            refresh();
        } finally {
            loading.set("doMath", false);
            loading = loading;
        }
    }
    async function doMath_Ed25519() {
        try {
            loading.set("doMath_Ed25519", true);
            loading = loading;

            const at = await mathContract.do_math({
                source: contractId_,
                a: BigInt(a),
                b: BigInt(b),
            });

            await pk_wallet.sign(at, { keypair });
            const res = await pk_server.send(at.built!);

            console.log(res);

            const meta = xdr.TransactionMeta.fromXDR(
                res.resultMetaXdr,
                "base64",
            );
            const result = scValToNative(
                meta.v3().sorobanMeta()!.returnValue(),
            );

            alert(`${a} + ${b} = ${result}`);

            refresh();
        } catch {
            alert("❌ Failed to invoke contract function");
        } finally {
            loading.set("doMath_Ed25519", false);
            loading = loading;
        }
    }

    // Function that adds a signer to your smart wallet
    async function addSigner_Ed25519() {
        try {
            loading.set("addSigner_Ed25519", true);
            loading = loading;

            // Define empty signer limits map
            const signer_limits: SignerLimits = new Map();

            // Call passkeys kit add ed25519 signer function
            const at = await pk_wallet.addEd25519(
                keypair.publicKey(),
                signer_limits,
                SignerStore.Temporary,
            );

            console.log("Add Signer Transaction");
            console.log(at);

            // Sign transaction with passkey
            await pk_wallet.sign(at, { keyId: keyId_ });

            // Submit transaction using passkeys server and launchtube
            console.log("Sending Add Signer Transaction...");
            await pk_server
                .send(at.built!)
                .then((res) => console.log(res))
                .catch((err) => console.log(err));
        } finally {
            loading.set("addSigner_Ed25519", false);
            loading = loading;
        }
    }

    // Attach Policy signer to smart wallet
    async function attach_Policy() {
        try {
            loading.set("attach_Policy", true);
            loading = loading;

            // Setup policy signer limits using the do math policy contract
            const ed25519_limits: SignerLimits = new Map();

            // ed25519 key can call do_math contract but only if it also calls the do_math policy
            ed25519_limits.set(import.meta.env.PUBLIC_DO_MATH, [
                SignerKey.Policy(import.meta.env.PUBLIC_DO_MATH_POLICY),
            ]);

            // Invoke passkeys wallet add signer function passing in the policy limits
            const at = await pk_wallet.addEd25519(
                keypair.publicKey(),
                ed25519_limits,
                SignerStore.Temporary,
            );

            // Sign the transaction using passkeys kit
            await pk_wallet.sign(at, { keyId: keyId_ });

            // Send the transaction using passkeys server and launchtube
            const res = await pk_server.send(at.built!);

            console.log(res);
        } finally {
            loading.set("attach_Policy", false);
            loading = loading;
        }
    }

    async function fundWallet() {
        console.log("Funding Wallet from " + fundPubkey);
        const amount: bigint | AssembledTransaction<bigint> = await native
            .balance({
                id: contractId_,
            })
            .catch(() => BigInt(0));

            
        if (Number(amount) > 1) return;

        const { built, ...transfer } = await native.transfer({
            to: contractId_,
            from: fundPubkey,
            amount: BigInt(10_000_000),
        });

        console.log(built);

        console.log("Sign Funding Transaction");
        await transfer.signAuthEntries({
            address: fundPubkey,
            signAuthEntry: fundSigner.signAuthEntry,
        });

        const res = await pk_server
            .send(built!)
            .catch((err) => console.log(err));

        console.log(fundPubkey);
        console.log(res);
    }

    async function transfer_Ed25519() {
        try {
            loading.set("transfer_Ed25519", true);
            loading = loading;

            const at = await native.transfer({
                from: contractId_,
                to: contractId_,
                amount: BigInt(1),
            });

            await pk_wallet.sign(at, { keypair });
            const res = await pk_server.send(at.built!);

            console.log(res);

            alert("😱 Transfer complete");
        } catch {
            alert("❌ Failed to transfer");
        } finally {
            loading.set("transfer_Ed25519", false);
            loading = loading;
        }
    }

    function refresh() {
        a = parseInt(Math.random().toString().slice(2, 5));
        b = parseInt(Math.random().toString().slice(2, 5));
    }
    function signOut() {
        keyId_ = "";
        contractId_ = "";
        location.assign(location.origin);
    }
</script>

<div class="divider divider-primary">Learning Path</div>

<div class="hero bg-base-100">
    <div class="hero-content text-center">
        <ul class="steps">
            <li class="step step-info">Sign-in with Passkey</li>
            <li class="step step-info">Invoke Smart Contract</li>
            <li class="step step-info">Add Signer</li>
            <li class="step step-info">Invoke Contract(Ed25519 Signer)</li>
            <li class="step step-info">Add Policy Signer</li>
            <li class="step step-info">Invoke Contract(Policy Signer)</li>
        </ul>
    </div>
</div>

<div class="flex w-full flex-col">
    {#if contractId_}
        <div class="divider">Deployed Wallet Contract</div>
        <div class="hero bg-base-100">
            <div class="hero-content text-center">
                <strong>Smart Wallet Contract ID:</strong>
                <div
                    class="tooltip"
                    data-tip="Link to Smart Contract Wallet on Stellar Expert"
                >
                    <a
                        class="link link-primary"
                        href="https://stellar.expert/explorer/testnet/contract/{contractId_}"
                        target="_blank"
                    >
                        {contractId_}
                    </a>
                </div>

                <button
                    class="btn btn-active btn-link text-white px-2 py-1 rounded"
                    on:click={signOut}>Sign Out</button
                >
            </div>
        </div>

        <div class="divider divider-primary">
            Invoke Deployed Smart Contract
        </div>

        <div class="container mx-auto">
            <div class="hero bg-base-100">
                <div class="hero-content text-center">
                    <button class="btn btn-primary" on:click={refresh}
                        >Refresh</button
                    >

                    <label class="input flex items-center gap-1">
                        First Int
                        <input
                            class="input input-bordered flex items-center gap-1"
                            type="number"
                            name="a"
                            id="a"
                            bind:value={a}
                        />
                    </label>

                    <label class="input flex items-center gap-1">
                        Second Int
                        <input
                            class="input input-bordered flex items-center gap-1"
                            type="number"
                            name="b"
                            id="b"
                            bind:value={b}
                        />
                    </label>

                    {#if keyId_}
                        <div
                            class="tooltip"
                            data-tip="Invoke function on deployed contract signing with passkey and using launchtube to push operation to network"
                        >
                            <button class="btn btn-primary" on:click={doMath}>
                                {#if loading.get("doMath")}
                                    <span class="loading loading-spinner"
                                    ></span>
                                {:else}
                                    Invoke Function
                                {/if}
                            </button>
                        </div>
                    {/if}

                    <div
                        class="tooltip"
                        data-tip="Invoke function with added Ed25519 signer"
                    >
                        <button
                            class="btn btn-secondary"
                            on:click={doMath_Ed25519}
                        >
                            {#if loading.get("doMath_Ed25519")}
                                <span class="loading loading-spinner"></span>
                            {:else}
                                Invoke Function (Ed25519)
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {#if keyId_}
            <div class="divider divider-warning">
                Add Classic Signer to Smart Wallet
            </div>

            <div class="hero bg-base-100">
                <div class="hero-content text-center">
                    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                    <div
                        tabindex="0"
                        class="collapse collapse-arrow border-base-300 bg-base-200 border"
                    >
                        <div class="collapse-title text-xl font-medium">
                            Add Signer?
                        </div>
                        <div class="collapse-content">
                            <p>
                                Adds a Classic Stellar account(ed25519) signer
                                to our wallet. This allows us to invoke the
                                smart contract function with the added Ed25519
                                signer.
                            </p>
                        </div>
                    </div>

                    <button class="btn btn-error" on:click={addSigner_Ed25519}>
                        {#if loading.get("addSigner_Ed25519")}
                            <span class="loading loading-spinner"></span>
                        {:else}
                            Add Signer (Ed25519)
                        {/if}
                    </button>
                </div>
            </div>

            <div class="divider divider-warning">
                Add Policy Signer to Smart Wallet
            </div>

            <div class="hero bg-base-100">
                <div class="hero-content text-center">
                    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                    <div
                        tabindex="0"
                        class="collapse collapse-arrow border-base-300 bg-base-200 border"
                    >
                        <div class="collapse-title text-xl font-medium">
                            Add Policy?
                        </div>
                        <div class="collapse-content">
                            <p>Add a Policy signer to our wallet</p>
                        </div>
                    </div>
                    <button
                        class="btn btn-active btn-accent"
                        on:click={attach_Policy}
                    >
                        {#if loading.get("attach_Policy")}
                            <span class="loading loading-spinner"></span>
                        {:else}
                            Attach Policy
                        {/if}
                    </button>
                </div>
            </div>
        {/if}

        <div class="divider divider-error">Danger of Adding Signers</div>

        <div class="hero bg-base-100">
            <div class="hero-content text-center">
                <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                <div
                    tabindex="0"
                    class="collapse collapse-arrow border-base-300 bg-base-200 border"
                >
                    <div class="collapse-title text-xl font-medium">
                        Transfer?
                    </div>
                    <div class="collapse-content">
                        <p>
                            Add the signer has granted access to transfer assets
                            out of the account
                        </p>
                    </div>
                </div>

                <button class="btn btn-error" on:click={transfer_Ed25519}>
                    {#if loading.get("transfer_Ed25519")}
                        <span class="loading loading-spinner"></span>
                    {:else}
                        Transfer (Ed25519)
                    {/if}
                </button>
            </div>
        </div>

        <div class="hero bg-base-100">
            <div class="hero-content text-center">
                <br/><br/>
            </div>
        </div>
    {:else}
        <div class="divider">Not Logged In</div>

        <div class="hero bg-base-100">
            <div class="hero-content text-center">
                <button
                    class="btn btn-active btn-primary"
                    on:click={createWallet}
                >
                    {#if loading.get("createWallet")}
                        <span class="loading loading-spinner"></span>
                    {:else}
                        Create New PassKey Wallet
                    {/if}
                </button>

                <button class="btn btn-active btn-primary" on:click={signIn}>
                    {#if loading.get("signIn")}
                        <span class="loading loading-spinner"></span>
                    {:else}
                        Sign In to Existing PassKey Wallet
                    {/if}
                </button>
            </div>
        </div>
    {/if}
</div>
