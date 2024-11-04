<script lang="ts">
    import { onMount } from "svelte";
    import { xdr, scValToNative, Keypair, Address } from "@stellar/stellar-sdk/minimal";
    import { Client, networks } from "do-math-sdk";
    import { PasskeyServer, PasskeyKit, SACClient, SignerStore, PasskeyClient, type SignerLimits, SignerKey } from "passkey-kit";
    import { fundPubkey, fundSigner } from "../lib/common";
    import QRCode from 'qrcode'
    

    let url: URL
    let qr_code: string

    const pk_server = new PasskeyServer({
        rpcUrl: import.meta.env.PUBLIC_RPC_URL,
        launchtubeUrl: import.meta.env.PUBLIC_LAUNCHTUBE_URL,
        launchtubeJwt: import.meta.env.PUBLIC_LAUNCHTUBE_JWT,
        mercuryUrl: import.meta.env.PUBLIC_MERCURY_URL,
        mercuryJwt: import.meta.env.PUBLIC_MERCURY_JWT
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

    const native = sac.getSACClient(import.meta.env.PUBLIC_NATIVE)

    let keypair: Keypair;
    let keyId_: string;
    let contractId_: string;

    let a: number;
    let b: number;

    let loading: Map<string, boolean> = new Map()

    $: {
        if (contractId_ && keypair)
            genQrCode(location.origin + `?contractId=${contractId_}&secret=${keypair.secret()}`)
    }

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
            connectWallet(keyId)
            .then(() => console.log("Wallet Connected"));

        } 

        if (secret) {
            keypair = Keypair.fromSecret(secret);
            console.log(keypair.publicKey());
        } else {
            keypair = Keypair.random();
            url.searchParams.set("secret", keypair.secret());
            history.pushState({}, '', url);
        }

        refresh();
    });

    async function createWallet() {
        try {
            loading.set("createWallet", true);
            loading = loading

            console.log("keypair");
            console.log(keypair);
            console.log(keypair.publicKey());
            console.log(keypair.secret());

            let walletName = prompt("Wallet Name?");

            const { keyId, keyId_base64, contractId, built } = await pk_wallet.createWallet(
                walletName,
                "Chris Anatalio",
                keypair.publicKey()
            );

            keyId_ = keyId_base64;

            console.log("keyid");
            console.log(keyId_base64);

            console.log(contractId);

            console.log(built);

            console.log("keypair");
            console.log(keypair);
            console.log(keypair.publicKey());
            console.log(keypair.secret());

            await pk_server.send(built)
            .then(res => console.log(res));

            url.searchParams.set("keyId", keyId_);
            history.pushState({}, '', url);

            contractId_ = contractId;

            fundWallet();
        } finally {
            loading.set("createWallet", false);
            loading = loading
        }
    }

	async function signIn() {
        loading.set("signIn", true);
        loading = loading

		try {

            let existingKeyId = prompt("What is your key id");
            console.log(existingKeyId);

			const { keyId_base64, contractId } = await pk_wallet.connectWallet({ existingKeyId });
            console.log("Contract ID");
            console.log(contractId);

            keyId_ = keyId_base64;

            url.searchParams.set("keyId", keyId_);
            url.searchParams.set("contractId", contractId);
            history.pushState({}, '', url);
            refresh();

            contractId_ = contractId;

		} catch (err: any) {
			console.log(err);
		} finally {
            loading.set("signIn", false);
            loading = loading
        }
	}

    async function connectWallet(keyId: string) {
        const { keyId_base64, contractId } = await pk_wallet.connectWallet({ keyId });

        keyId_ = keyId_base64;

        if (!keyId) {
            url.searchParams.set("keyId", keyId_);
            history.pushState({}, '', url);
        }

        console.log(pk_wallet.wallet);

        let clientWallet: PasskeyClient = pk_wallet.wallet;

        contractId_ = contractId;
    }

    async function doMath() {
        try {
            loading.set("doMath", true);
            loading = loading;

            console.log("Creating Transaction");

            const at = await mathContract.do_math({
                source: contractId_,
                a: 125,
                b: 130,
            });

            console.log("Transaction");
            console.log(at);
            console.log(keyId_);
            console.log(contractId_);

            console.log("Signing");

            
            await pk_wallet.sign(at, { keyId: keyId_ })
            .then(val => console.log(val))
            .catch(err => console.log(err));
            

            console.log("Transaction After Signing");
            console.log(at);

            console.log("Invoking Contract");

            console.log("Sending Transaction");
            const res = await pk_server.send(at.built!)            
            .then(val => console.log(val))
            .catch(err => console.log(err));

            console.log("Response");
            console.log(res);

            const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, "base64");
            const result = scValToNative(meta.v3().sorobanMeta()!.returnValue());

            alert(`${a} + ${b} = ${result}`);

            refresh();
        } finally {
            loading.set("doMath", false);
            loading = loading
        }
    }
    async function doMath_Ed25519() {
        try {
            loading.set("doMath_Ed25519", true);
            loading = loading

            const at = await contract.do_math({
                source: contractId_,
                a: BigInt(a),
                b: BigInt(b),
                sac: import.meta.env.PUBLIC_NATIVE // import.meta.env.PUBLIC_NATIVE
            });
            
            await pk_wallet.sign(at, { keypair });
            const res = await pk_server.send(at.built!);

            console.log(res);

            const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, "base64");
            const result = scValToNative(meta.v3().sorobanMeta()!.returnValue());

            alert(`${a} + ${b} = ${result}`);

            refresh();
        } catch {
            alert("❌ Failed to do math");
        } finally {
            loading.set("doMath_Ed25519", false);
            loading = loading
        }
    }

    async function addSigner_Ed25519() {
        try {
            loading.set("addSigner_Ed25519", true);
            loading = loading

            let addSignerKp = Keypair.fromSecret("SARTTKDQAOTLG2BJEOPIPPUTAQHSEY4QBWQO5QGGDWL4DPYBOFP3MG4F");

            console.log(keypair.publicKey());

            const signer_limits: SignerLimits = new Map();

            const at = await pk_wallet.addEd25519(addSignerKp.publicKey(), signer_limits, SignerStore.Temporary);

            console.log("Transaction");
            console.log(at);
            console.log(pk_server);
            console.log(pk_wallet);
            console.log("key id")
            console.log(keyId_);

            await pk_wallet.sign(at, { keyId: keyId_});

            console.log(at.toXDR());

            console.log("Sending...");
            await pk_server.send(at.built.toXDR())
            .then(res => console.log(res))
            .catch(err => console.log(err));

        } finally {
            loading.set("addSigner_Ed25519", false);
            loading = loading
        }
    }
    async function attach_Policy() {
        try {
            loading.set("attach_Policy", true);
            loading = loading

            const ed25519_limits: SignerLimits = new Map();

            // ed25519 key can call do_math contract but only if it also calls the do_math policy
            ed25519_limits.set(import.meta.env.PUBLIC_DO_MATH, [SignerKey.Policy(import.meta.env.PUBLIC_DO_MATH_POLICY)])

            const at = await pk_wallet.addEd25519(
                keypair.publicKey(), 
                ed25519_limits,
                SignerStore.Temporary
            );

            await pk_wallet.sign(at, { keyId: keyId_ });
            const res = await pk_server.send(at.built!);

            console.log(res);
        } finally {
            loading.set("attach_Policy", false);
            loading = loading
        }
    }

    async function fundWallet() {
        console.log("Funding Wallet from " + fundPubkey);
        const amount = await native.balance({
            id: contractId_,
        })
        .then(({ result }) => result)
        .catch(() => BigInt(0))

        console.log(amount);

        if (amount > 1)
            return
        
        const { built, ...transfer } = await native.transfer({
			to: contractId_,
			from: fundPubkey,
			amount: BigInt(10_000_000),
		});

        console.log(built);

        console.log("Sign Funding");
		await transfer.signAuthEntries({
			address: fundPubkey,
			signAuthEntry: fundSigner.signAuthEntry,
		});

		const res = await pk_server.send(built.toXDR())
        .catch(err => console.log(err));

        console.log(fundPubkey);
		console.log(res);
	}

    async function transfer_Ed25519() {
        try {
            loading.set("transfer_Ed25519", true);
            loading = loading

            const at = await native.transfer({
                from: contractId_,
                to: contractId_,
                amount: BigInt(1),
            })

            await pk_wallet.sign(at, { keypair });
            const res = await pk_server.send(at.built!);

            console.log(res);

            alert("😱 Transfer complete");
        } catch {
            alert("❌ Failed to transfer");
        } finally {
            loading.set("transfer_Ed25519", false);
            loading = loading
        }
    }

    async function genQrCode(data) {
        qr_code = await QRCode.toDataURL(data, {
            errorCorrectionLevel: 'L',
            margin: 0,
        })
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
        <li class="step step-info">Add Signer to Wallet</li>
        <li class="step step-info">Transfer funds out of account</li>
      </ul>

</div>
</div>

<div class="flex w-full flex-col">

{#if contractId_}

<div role="alert" class="alert alert-success">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6 shrink-0 stroke-current"
      fill="none"
      viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>You have successfully setup your new smart wallet with your passkey!</span>
  </div>

    <div class="divider">Deployed Contract</div>
    <div class="hero bg-base-100">
        <div class="hero-content text-center">
        <strong>Contract ID:</strong> {contractId_}
        <button class="btn btn-active btn-link text-white px-2 py-1 rounded" on:click={signOut}>Sign Out</button>
    </div>
    </div>

    <div class="divider divider-primary">Do-Math Contract</div>

    <div class="container mx-auto">

        <div class="hero bg-base-100">
            <div class="hero-content text-center">
                <button class="btn btn-primary" on:click={refresh}>Refresh</button>

                <label class="input flex items-center gap-1">
                    First Int
                    <input class="input input-bordered flex items-center gap-1" type="number" name="a" id="a" bind:value={a} />
                </label>
        
                <label class="input flex items-center gap-1">
                    Second Int
                    <input class="input input-bordered flex items-center gap-1" type="number" name="b" id="b" bind:value={b} />
                </label>


        
        
        
        {#if keyId_}
        <div class="tooltip" data-tip="Invoke do_math function on deployed contract signing with passkey and using launchtube to push operation to network">
            <button class="btn btn-primary" on:click={doMath}>
                {#if loading.get("doMath")}
                <span class="loading loading-spinner"></span>
                {:else}
                    Invoke Do Math Function
                {/if}
            </button>
        </div>
        {/if}

        <button class="btn btn-secondary" on:click={doMath_Ed25519}>
            {#if loading.get("doMath_Ed25519")}
            <span class="loading loading-spinner"></span>
            {:else}
            Invoke Do Math Function (Ed25519)
            {/if}
        
        </button>

    </div>
</div>

    </div>

    {#if keyId_}

        <div class="divider divider-warning">Add Classic Signer to Wallet</div>


        <div class="hero bg-base-100">
            <div class="hero-content text-center">

                <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                <div tabindex="0" class="collapse collapse-arrow border-base-300 bg-base-200 border">
                    <div class="collapse-title text-xl font-medium">Add Signer???</div>
                    <div class="collapse-content">
                      <p>
                        We will add a Classic Stellar account(ed25519)  signer to our wallet


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

        <div class="divider divider-warning">Add Policy Signer to Wallet</div>

        <div class="hero bg-base-100">
            <div class="hero-content text-center">

                <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                <div tabindex="0" class="collapse collapse-arrow border-base-300 bg-base-200 border">
                    <div class="collapse-title text-xl font-medium">Add Policy???</div>
                    <div class="collapse-content">
                      <p>
                        We will add a Policy signer to our wallet


                      </p>
                    </div>
                  </div>
                <button class="btn btn-active btn-accent" on:click={attach_Policy}>
                    {#if loading.get("attach_Policy")}
                    <span class="loading loading-spinner"></span>
                    {:else}
                        Attach Policy
                    {/if}
                </button>
            </div>
        </div>

    {/if}

    <div class="divider divider-error">Danger Zone</div>

    <br />
    <div class="hero bg-base-100">
        <div class="hero-content text-center">

                        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                        <div tabindex="0" class="collapse collapse-arrow border-base-300 bg-base-200 border">
                            <div class="collapse-title text-xl font-medium">Transfer???</div>
                            <div class="collapse-content">
                              <p>
                                Add the signer has granted access to transfer assets out of the account
        
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

    {#if keypair}    
            <a class="btn btn-error" href={location.origin + `?contractId=${contractId_}&secret=${keypair.secret()}`} target="_blank" rel="nofollow">
                Share (Ed25519)
            </a>
    {/if}
</div>
</div>

<div class="divider">URL</div>

<div class="hero bg-base-100">
    <div class="hero-content text-center">
    <img class="" src={qr_code} alt="qr code">
</div>
</div>

{:else}

<div class="divider">Not Logged In</div>

<div class="hero bg-base-100">
    <div class="hero-content text-center">
    <button class="btn btn-active btn-primary" on:click={createWallet}>
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