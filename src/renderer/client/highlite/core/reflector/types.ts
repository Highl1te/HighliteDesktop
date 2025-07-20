// Class information for a declared class
export interface ClassInfo {
    name : string;
    staticFields : string[];
    instanceFields : string[];
    staticMethods : {
        name: string;
        kind: string
    }[];
    instanceMethods : {
        name: string;
        kind: string
    }[];
    start : number,
    end : number
}

// Search criteria for mapping a class
export interface ClassSignature {
    fields?: string[];
    methods?: string[];
}

//  Search criteria for mapping an enum
export interface EnumInfo {
    name: string,
    members: [string],
    start:  number,
    end: number
}

// Enum information for a declared enum
export interface EnumSignature {
    includes: string[],
    excludes?: string[]
}

// Define a mapping between hook logical names and their obfuscated runtime identifiers
export type HookMap = Map<string, string>;

// Define the serialized representation of a HookMap (for IndexedDB storage)
export type HookEntries = [string, string][];