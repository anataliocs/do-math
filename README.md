# Passkey Kit Reference Impl

> [!WARNING]  
> Code in this repo is demo material only. It has not been audited. Do not use to hold, protect, or secure anything.

Passkey kit is a basic TypeScript SDK for creating and managing Stellar smart wallets. It's intended to be used in tandem with [Launchtube](https://github.com/kalepail/launchtube) for submitting passkey signed transactions onchain however this is not a requirement. This is both a client and a server side library. `PasskeyKit` on the client and `PasskeyServer` on the server.

> [!WARNING]  
> You must use pnpm for this project to work


On the client:
```ts
const account = new PasskeyKit({
    rpcUrl: env.PUBLIC_rpcUrl,
    networkPassphrase: env.PUBLIC_networkPassphrase,
    factoryContractId: env.PUBLIC_factoryContractId,
});
```

On the server:
```ts
const account = new PasskeyServer({
    rpcUrl: env.PUBLIC_rpcUrl,
    launchtubeUrl: env.PUBLIC_launchtubeUrl,
    launchtubeJwt: env.PRIVATE_launchtubeJwt,
    mercuryUrl: env.PUBLIC_mercuryUrl,
    mercuryJwt: env.PRIVATE_mercuryJwt,
});
```

Install dependencies
```bash
pnpm i
```

Build:

```bash
pnpm run build
```

Run:

```bash
pnpm run start
```




Debugging steps
- cargo update
- Update bindings stellar contract bindings typescript