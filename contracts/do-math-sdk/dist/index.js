import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';
if (typeof window !== 'undefined') {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    testnet: {
        networkPassphrase: "Test SDF Network ; September 2015",
        contractId: "CB2TOIAQHT6DZRLAZWJIZMQNBIKG2LJWBXCTXDDVVBNBZCXDSQD4H2DS",
    }
};
export const Errors = {};
export class Client extends ContractClient {
    options;
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAAAAAAAHZG9fbWF0aAAAAAADAAAAAAAAAAZzb3VyY2UAAAAAABMAAAAAAAAAAWEAAAAAAAALAAAAAAAAAAFiAAAAAAAACwAAAAEAAAAL"]), options);
        this.options = options;
    }
    fromJSON = {
        do_math: (this.txFromJSON)
    };
}
