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

// Hook info class
export type HookInfo = Map<string, string>;