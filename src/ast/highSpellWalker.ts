import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as acorn from "acorn";
import { walk, Node } from "estree-walker-ts";
import { obtainGameClient } from "../utils/clientUtils";

interface GameHookDependency {
    hookName: string;
    propertyChain: string[];
    fullExpression: string;
    file: string;
    line: number;
    isDirect: boolean; // true for direct access, false for indirect via variable
    sourceVariable?: string; // name of variable if indirect access
}

interface GameHookUsage {
    [hookName: string]: {
        properties: Set<string>;
        methods: Set<string>;
        nestedObjectUsage: Set<string>; // For methods/properties of nested objects accessed through the hook
        fullExpressions: Set<string>;
        files: Set<string>;
        fromDirectAccess: boolean;
        fromHookRegistration: boolean;
    };
}

interface ClientClass {
    name: string;
    properties: Set<string>;
    methods: Set<string>;
    staticProperties: Set<string>;
    staticMethods: Set<string>;
    hasInstance: boolean;
    hasManager: boolean;
}

interface ClassMatch {
    hookName: string;
    clientClassName: string;
    matchScore: number;
    matchedProperties: string[];
    matchedMethods: string[];
    missingProperties: string[];
    missingMethods: string[];
}

interface KnownClassInfo {
    className: string;
    methods?: string[];
    properties?: string[];
    staticMethods?: string[];
    staticProperties?: string[];
    description?: string;
}

interface VariableGameHookReference {
    variableName: string;
    hookName: string;
    propertyChain: string[];
    fullGameHookExpression: string;
    declarationLine: number;
    scope: string; // simple scope tracking
}

interface ScopeTracker {
    currentScope: string;
    scopeCounter: number;
    variableReferences: Map<string, VariableGameHookReference>;
}

// Known class information to help with matching decisions
const knownClassInfo: KnownClassInfo[] = [
    {
        className: "ChatManager",
        properties: ["Instance", "_friends"],
        staticProperties: ["Instance"],
        description: "Manages chat functionality and friends list"
    }
];

async function findTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    async function traverseDir(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory() &&
                !entry.name.startsWith('.') &&
                !['node_modules', 'out', 'dist', 'build'].includes(entry.name)) {
                await traverseDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }
    }

    await traverseDir(dir);
    return files;
}

function extractPropertyChain(node: ts.Node): string[] {
    const chain: string[] = [];

    function traverse(n: ts.Node) {
        if (ts.isPropertyAccessExpression(n)) {
            traverse(n.expression);
            chain.push(n.name.text);
        } else if (ts.isIdentifier(n)) {
            chain.push(n.text);
        } else if (ts.isCallExpression(n)) {
            traverse(n.expression);
            chain[chain.length - 1] += '()';
        }
    }

    traverse(node);
    return chain;
}

function isGameHooksAccess(chain: string[]): boolean {
    return (chain.length >= 4 && chain[0] === 'document' && chain[1] === 'highlite' && chain[2] === 'gameHooks') ||
        (chain.length >= 3 && chain[0] === 'highlite' && chain[1] === 'gameHooks') ||
        (chain.length >= 3 && chain[0] === 'this' && chain[1] === 'gameHooks') ||
        (chain.length >= 2 && chain[0] === 'gameHooks');
}

function getHookNameAndProperties(chain: string[]): { hookName: string; properties: string[] } {
    let startIndex = -1;

    if (chain.length >= 4 && chain[0] === 'document' && chain[1] === 'highlite' && chain[2] === 'gameHooks') {
        startIndex = 3;
    } else if (chain.length >= 3 && chain[0] === 'highlite' && chain[1] === 'gameHooks') {
        startIndex = 2;
    } else if (chain.length >= 3 && chain[0] === 'this' && chain[1] === 'gameHooks') {
        startIndex = 2;
    } else if (chain.length >= 2 && chain[0] === 'gameHooks') {
        startIndex = 1;
    }

    if (startIndex === -1 || startIndex >= chain.length) {
        return { hookName: '', properties: [] };
    }

    return {
        hookName: chain[startIndex],
        properties: chain.slice(startIndex + 1)
    };
}

function nodeToString(node: ts.Node): string {
    if (ts.isPropertyAccessExpression(node)) {
        const object = nodeToString(node.expression);
        return `${object}.${node.name.text}`;
    } else if (ts.isIdentifier(node)) {
        return node.text;
    } else if (ts.isCallExpression(node)) {
        const callee = nodeToString(node.expression);
        return `${callee}()`;
    }
    return '[unknown]';
}

interface ClassMapping {
    clientClassName: string;
    hookName: string;
    methods: Set<string>;
    file: string;
}

async function extractClassMappingsFromCore(filePath: string): Promise<ClassMapping[]> {
    const mappings: ClassMapping[] = [];

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'registerClass' &&
                node.arguments.length >= 2) {

                const clientClassArg = node.arguments[0];
                const hookNameArg = node.arguments[1];

                if (ts.isStringLiteral(clientClassArg) && ts.isStringLiteral(hookNameArg)) {
                    const clientClassName = clientClassArg.text;
                    const hookName = hookNameArg.text;

                    mappings.push({
                        clientClassName,
                        hookName,
                        methods: new Set(),
                        file: filePath
                    });
                }
            }

            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'registerClassHook' &&
                node.arguments.length >= 2) {

                const classNameArg = node.arguments[0];
                const methodNameArg = node.arguments[1];

                if (ts.isStringLiteral(classNameArg) && ts.isStringLiteral(methodNameArg)) {
                    const hookName = classNameArg.text;
                    const methodName = methodNameArg.text;

                    let mapping = mappings.find(m => m.hookName === hookName);
                    if (!mapping) {
                        mapping = {
                            clientClassName: 'UNKNOWN',
                            hookName,
                            methods: new Set(),
                            file: filePath
                        };
                        mappings.push(mapping);
                    }
                    mapping.methods.add(methodName);
                }
            }

            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'registerClassOverrideHook' &&
                node.arguments.length >= 2) {

                const classNameArg = node.arguments[0];
                const methodNameArg = node.arguments[1];

                if (ts.isStringLiteral(classNameArg) && ts.isStringLiteral(methodNameArg)) {
                    const hookName = classNameArg.text;
                    const methodName = methodNameArg.text;

                    let mapping = mappings.find(m => m.hookName === hookName);
                    if (!mapping) {
                        mapping = {
                            clientClassName: 'UNKNOWN',
                            hookName,
                            methods: new Set(),
                            file: filePath
                        };
                        mappings.push(mapping);
                    }
                    mapping.methods.add(methodName);
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    } catch (error) {
        console.warn(`Error parsing ${filePath} for class mappings:`, error.message);
    }

    return mappings;
}

async function analyzeFileForHookRegistrations(filePath: string): Promise<GameHookUsage> {
    const hookUsage: GameHookUsage = {};

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'registerClassHook' &&
                node.arguments.length >= 2) {

                const classNameArg = node.arguments[0];
                const methodNameArg = node.arguments[1];

                if (ts.isStringLiteral(classNameArg) && ts.isStringLiteral(methodNameArg)) {
                    const className = classNameArg.text;
                    const methodName = methodNameArg.text;

                    if (!hookUsage[className]) {
                        hookUsage[className] = {
                            properties: new Set(),
                            methods: new Set(),
                            nestedObjectUsage: new Set(),
                            fullExpressions: new Set(),
                            files: new Set(),
                            fromDirectAccess: false,
                            fromHookRegistration: true
                        };
                    }
                    hookUsage[className].methods.add(methodName);
                    hookUsage[className].files.add(filePath);
                }
            }

            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'registerClassOverrideHook' &&
                node.arguments.length >= 2) {

                const classNameArg = node.arguments[0];
                const methodNameArg = node.arguments[1];

                if (ts.isStringLiteral(classNameArg) && ts.isStringLiteral(methodNameArg)) {
                    const className = classNameArg.text;
                    const methodName = methodNameArg.text;

                    if (!hookUsage[className]) {
                        hookUsage[className] = {
                            properties: new Set(),
                            methods: new Set(),
                            nestedObjectUsage: new Set(),
                            fullExpressions: new Set(),
                            files: new Set(),
                            fromDirectAccess: false,
                            fromHookRegistration: true
                        };
                    }
                    hookUsage[className].methods.add(methodName);
                    hookUsage[className].files.add(filePath);
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    } catch (error) {
        console.warn(`Error parsing ${filePath} for hook registrations:`, error.message);
    }

    return hookUsage;
}

async function analyzeFileForGameHooks(filePath: string): Promise<GameHookDependency[]> {
    const dependencies: GameHookDependency[] = [];

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const scopeTracker: ScopeTracker = {
            currentScope: 'global',
            scopeCounter: 0,
            variableReferences: new Map()
        };

        const enterScope = () => {
            scopeTracker.scopeCounter++;
            scopeTracker.currentScope = `scope_${scopeTracker.scopeCounter}`;
        };

        const exitScope = () => {
            const keysToRemove: string[] = [];
            // Convert Map entries to array to avoid iterator issues
            Array.from(scopeTracker.variableReferences.entries()).forEach(([key, ref]) => {
                if (ref.scope === scopeTracker.currentScope) {
                    keysToRemove.push(key);
                }
            });
            keysToRemove.forEach(key => scopeTracker.variableReferences.delete(key));
            
            scopeTracker.currentScope = 'global';
        };

        const visit = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || 
                ts.isArrowFunction(node) || ts.isBlock(node)) {
                enterScope();
            }

            // Check for variable declarations that assign game hook references
            if (ts.isVariableDeclaration(node) && node.initializer) {
                const variableName = ts.isIdentifier(node.name) ? node.name.text : null;
                
                if (variableName) {
                    // Check if the initializer is a game hooks access
                    const chain = extractPropertyChain(node.initializer);
                    
                    if (isGameHooksAccess(chain)) {
                        const { hookName, properties } = getHookNameAndProperties(chain);
                        
                        if (hookName) {
                            const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                            const fullExpression = nodeToString(node.initializer);
                            
                            // Store the variable reference
                            scopeTracker.variableReferences.set(variableName, {
                                variableName,
                                hookName,
                                propertyChain: properties,
                                fullGameHookExpression: fullExpression,
                                declarationLine: lineNumber,
                                scope: scopeTracker.currentScope
                            });

                            // Record the direct access
                            dependencies.push({
                                hookName,
                                propertyChain: properties,
                                fullExpression,
                                file: filePath,
                                line: lineNumber,
                                isDirect: true
                            });
                        }
                    }
                }
            }

            // Check for direct game hooks access
            if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) {
                const chain = extractPropertyChain(node);

                if (isGameHooksAccess(chain)) {
                    const { hookName, properties } = getHookNameAndProperties(chain);

                    if (hookName) {
                        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                        const fullExpression = nodeToString(node);
                        
                        // Only add if this isn't part of a variable declaration (already handled above)
                        const parent = node.parent;
                        const isPartOfVariableDeclaration = parent && ts.isVariableDeclaration(parent) && parent.initializer === node;
                        
                        if (!isPartOfVariableDeclaration) {
                            dependencies.push({
                                hookName,
                                propertyChain: properties,
                                fullExpression,
                                file: filePath,
                                line: lineNumber,
                                isDirect: true
                            });
                        }
                    }
                }
                
                // Check for indirect access via tracked variables
                else if (ts.isPropertyAccessExpression(node)) {
                    const objectExpression = node.expression;
                    
                    if (ts.isIdentifier(objectExpression)) {
                        const variableName = objectExpression.text;
                        const variableRef = scopeTracker.variableReferences.get(variableName);
                        
                        if (variableRef) {
                            const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                            const propertyName = node.name.text;
                            const fullExpression = nodeToString(node);
                            
                            dependencies.push({
                                hookName: variableRef.hookName,
                                propertyChain: [...variableRef.propertyChain, propertyName],
                                fullExpression,
                                file: filePath,
                                line: lineNumber,
                                isDirect: false,
                                sourceVariable: variableName
                            });
                        }
                    }
                }
                
                // Check for indirect method calls via tracked variables
                else if (ts.isCallExpression(node)) {
                    if (ts.isPropertyAccessExpression(node.expression)) {
                        const objectExpression = node.expression.expression;
                        
                        if (ts.isIdentifier(objectExpression)) {
                            const variableName = objectExpression.text;
                            const variableRef = scopeTracker.variableReferences.get(variableName);
                            
                            if (variableRef) {
                                const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                                const methodName = node.expression.name.text;
                                const fullExpression = nodeToString(node);
                                
                                dependencies.push({
                                    hookName: variableRef.hookName,
                                    propertyChain: [...variableRef.propertyChain, `${methodName}()`],
                                    fullExpression,
                                    file: filePath,
                                    line: lineNumber,
                                    isDirect: false,
                                    sourceVariable: variableName
                                });
                            }
                        }
                    }
                    // Handle direct calls on variables (e.g., variableName())
                    else if (ts.isIdentifier(node.expression)) {
                        const variableName = node.expression.text;
                        const variableRef = scopeTracker.variableReferences.get(variableName);
                        
                        if (variableRef) {
                            const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                            const fullExpression = nodeToString(node);
                            
                            dependencies.push({
                                hookName: variableRef.hookName,
                                propertyChain: [...variableRef.propertyChain, '()'],
                                fullExpression,
                                file: filePath,
                                line: lineNumber,
                                isDirect: false,
                                sourceVariable: variableName
                            });
                        }
                    }
                }
            }

            ts.forEachChild(node, visit);

            // Handle scope exit
            if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || 
                ts.isArrowFunction(node) || ts.isBlock(node)) {
                exitScope();
            }
        };

        visit(sourceFile);
    } catch (error) {
        console.warn(`Error parsing ${filePath}:`, error.message);
    }

    return dependencies;
}

function parseClientForClasses(clientCode: string): Promise<ClientClass[]> {
    return new Promise((resolve) => {
        const classes: ClientClass[] = [];
        const classMap = new Map<string, ClientClass>();
        let currentClass: string | null = null;

        try {
            const MyParser = acorn.Parser.extend(
                require("acorn-private-methods")
            );

            const ast = MyParser.parse(clientCode, {
                ecmaVersion: "latest",
                sourceType: "module",
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true,
                checkPrivateFields: true,
            });

            walk(ast as Node, {
                enter: (node) => {
                    if (node.type === 'ClassDeclaration' &&
                        node.id && node.id.type === 'Identifier') {

                        const className = node.id.name;
                        if (className.length <= 3 && /^[A-Za-z]{1,3}$/.test(className)) {
                            currentClass = className;
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    properties: new Set(),
                                    methods: new Set(),
                                    staticProperties: new Set(),
                                    staticMethods: new Set(),
                                    hasInstance: false,
                                    hasManager: false
                                });
                            }
                        }
                    }

                    if (node.type === 'VariableDeclarator' &&
                        node.id && node.id.type === 'Identifier' &&
                        node.init && node.init.type === 'FunctionExpression') {

                        const className = node.id.name;
                        if (className.length <= 3 && /^[A-Za-z]{1,3}$/.test(className)) {
                            currentClass = className;
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    properties: new Set(),
                                    methods: new Set(),
                                    staticProperties: new Set(),
                                    staticMethods: new Set(),
                                    hasInstance: false,
                                    hasManager: false
                                });
                            }
                        }
                    }

                    if (node.type === 'FunctionDeclaration' &&
                        node.id && node.id.type === 'Identifier') {

                        const className = node.id.name;
                        if (className.length <= 3 && /^[A-Za-z]{1,3}$/.test(className)) {
                            currentClass = className;
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    properties: new Set(),
                                    methods: new Set(),
                                    staticProperties: new Set(),
                                    staticMethods: new Set(),
                                    hasInstance: false,
                                    hasManager: false
                                });
                            }
                        }
                    }

                    if (node.type === 'MethodDefinition' &&
                        node.key && node.key.type === 'Identifier' &&
                        currentClass && classMap.has(currentClass)) {

                        const methodName = node.key.name;
                        const clientClass = classMap.get(currentClass)!;

                        if (node.static) {
                            clientClass.staticMethods.add(methodName);
                            if (methodName === 'Instance') {
                                clientClass.hasInstance = true;
                                clientClass.staticProperties.add('Instance');
                            }
                        } else {
                            clientClass.methods.add(methodName);
                        }
                    }

                    if (node.type === 'MethodDefinition' &&
                        (node.kind === 'get' || node.kind === 'set') &&
                        node.key && node.key.type === 'Identifier' &&
                        currentClass && classMap.has(currentClass)) {

                        const propName = node.key.name;
                        const clientClass = classMap.get(currentClass)!;

                        if (node.static) {
                            clientClass.staticProperties.add(propName);
                            if (propName === 'Instance') {
                                clientClass.hasInstance = true;
                            }
                            if (propName === 'Manager') {
                                clientClass.hasManager = true;
                            }
                        } else {
                            clientClass.properties.add(propName);
                        }
                    }

                    if (node.type === 'AssignmentExpression' &&
                        node.left && node.left.type === 'MemberExpression' &&
                        node.left.object && node.left.object.type === 'MemberExpression' &&
                        node.left.object.object && node.left.object.object.type === 'Identifier' &&
                        node.left.object.property && node.left.object.property.type === 'Identifier' &&
                        node.left.object.property.name === 'prototype' &&
                        node.left.property && node.left.property.type === 'Identifier') {

                        const className = node.left.object.object.name;
                        const methodName = node.left.property.name;

                        if (className.length <= 3 && /^[A-Za-z]{1,3}$/.test(className)) {
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    properties: new Set(),
                                    methods: new Set(),
                                    staticProperties: new Set(),
                                    staticMethods: new Set(),
                                    hasInstance: false,
                                    hasManager: false
                                });
                            }
                            classMap.get(className)!.methods.add(methodName);
                        }
                    }

                    if (node.type === 'AssignmentExpression' &&
                        node.left && node.left.type === 'MemberExpression' &&
                        node.left.object && node.left.object.type === 'Identifier' &&
                        node.left.property && node.left.property.type === 'Identifier') {

                        const className = node.left.object.name;
                        const propertyName = node.left.property.name;

                        if (className.length <= 3 && /^[A-Za-z]{1,3}$/.test(className)) {
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    properties: new Set(),
                                    methods: new Set(),
                                    staticProperties: new Set(),
                                    staticMethods: new Set(),
                                    hasInstance: false,
                                    hasManager: false
                                });
                            }
                            const clientClass = classMap.get(className)!;
                            clientClass.staticProperties.add(propertyName);

                            if (propertyName === 'Instance') {
                                clientClass.hasInstance = true;
                            }
                            if (propertyName === 'Manager') {
                                clientClass.hasManager = true;
                            }
                        }
                    }

                    if (node.type === 'AssignmentExpression' &&
                        node.left && node.left.type === 'MemberExpression' &&
                        node.left.object && node.left.object.type === 'ThisExpression' &&
                        node.left.property && node.left.property.type === 'Identifier') {

                        const propertyName = node.left.property.name;

                        if (currentClass && classMap.has(currentClass)) {
                            classMap.get(currentClass)!.properties.add(propertyName);
                        } else {
                            for (const clientClass of Array.from(classMap.values())) {
                                clientClass.properties.add(propertyName);
                            }
                        }
                    }
                },
                leave: (node) => {
                    if (node.type === 'ClassDeclaration' ||
                        node.type === 'FunctionDeclaration' ||
                        (node.type === 'VariableDeclarator' && node.init && node.init.type === 'FunctionExpression')) {
                        currentClass = null;
                    }
                }
            });

            for (const clientClass of Array.from(classMap.values())) {
                if (clientClass.properties.size > 0 || clientClass.methods.size > 0 ||
                    clientClass.staticProperties.size > 0 || clientClass.staticMethods.size > 0) {
                    classes.push(clientClass);
                }
            }

        } catch (error) {
            console.warn('Error parsing client code with acorn:', error.message);
        }

        resolve(classes);
    });
}

function calculateMatchScore(hookUsage: GameHookUsage[string], clientClass: ClientClass, hookName: string): ClassMatch {
    const requiredProperties = Array.from(hookUsage.properties);
    const requiredMethods = Array.from(hookUsage.methods);

    const matchedProperties: string[] = [];
    const matchedMethods: string[] = [];
    const missingProperties: string[] = [];
    const missingMethods: string[] = [];

    let score = 0;

    // Check required properties from codebase analysis
    for (const prop of requiredProperties) {
        if (clientClass.properties.has(prop) || clientClass.staticProperties.has(prop)) {
            matchedProperties.push(prop);
            score += 2;
        } else {
            missingProperties.push(prop);
        }
    }

    // Check required methods from codebase analysis
    for (const method of requiredMethods) {
        if (clientClass.methods.has(method) || clientClass.staticMethods.has(method)) {
            matchedMethods.push(method);
            score += 1;
        } else {
            missingMethods.push(method);
        }
    }

    // Check against known class information
    const knownInfo = knownClassInfo.find(info => info.className === hookName);
    if (knownInfo) {
        // Check known properties
        if (knownInfo.properties) {
            for (const prop of knownInfo.properties) {
                if (clientClass.properties.has(prop) || clientClass.staticProperties.has(prop)) {
                    if (!matchedProperties.includes(prop)) {
                        matchedProperties.push(prop);
                    }
                    score += 3; // Higher weight for known properties
                } else if (!requiredProperties.includes(prop)) {
                    missingProperties.push(prop);
                }
            }
        }

        // Check known static properties
        if (knownInfo.staticProperties) {
            for (const prop of knownInfo.staticProperties) {
                if (clientClass.staticProperties.has(prop)) {
                    if (!matchedProperties.includes(prop)) {
                        matchedProperties.push(prop);
                    }
                    score += 3; // Higher weight for known static properties
                } else if (!requiredProperties.includes(prop)) {
                    missingProperties.push(prop);
                }
            }
        }

        // Check known methods
        if (knownInfo.methods) {
            for (const method of knownInfo.methods) {
                if (clientClass.methods.has(method) || clientClass.staticMethods.has(method)) {
                    if (!matchedMethods.includes(method)) {
                        matchedMethods.push(method);
                    }
                    score += 2; // Higher weight for known methods
                } else if (!requiredMethods.includes(method)) {
                    missingMethods.push(method);
                }
            }
        }

        // Check known static methods
        if (knownInfo.staticMethods) {
            for (const method of knownInfo.staticMethods) {
                if (clientClass.staticMethods.has(method)) {
                    if (!matchedMethods.includes(method)) {
                        matchedMethods.push(method);
                    }
                    score += 2; // Higher weight for known static methods
                } else if (!requiredMethods.includes(method)) {
                    missingMethods.push(method);
                }
            }
        }
    }

    // Bonus points for common patterns
    if (requiredProperties.includes('Instance') && clientClass.hasInstance) {
        score += 5;
    }

    if (requiredProperties.includes('Manager') && clientClass.hasManager) {
        score += 3;
    }

    return {
        hookName: hookName,
        clientClassName: clientClass.name,
        matchScore: score,
        matchedProperties,
        matchedMethods,
        missingProperties,
        missingMethods
    };
}

async function analyzeGameHookDependencies() {
    console.log("🔍 Analyzing codebase for class mappings and dependencies...\n");

    const projectRoot = path.resolve(__dirname, '../../');
    const files = await findTypeScriptFiles(projectRoot);

    console.log(`Found ${files.length} TypeScript files to analyze\n`);

    const coreFilePath = path.join(projectRoot, 'src/renderer/client/highlite/core/core.ts');
    console.log("📋 Extracting class mappings from core.ts...");
    const classMappings = await extractClassMappingsFromCore(coreFilePath);

    console.log(`Found ${classMappings.length} class mappings:\n`);
    for (const mapping of classMappings) {
        console.log(`   ${mapping.hookName} → ${mapping.clientClassName}`);
    }

    const allDependencies: GameHookDependency[] = [];
    const allHookRegistrations: GameHookUsage = {};

    for (const file of files) {
        const deps = await analyzeFileForGameHooks(file);
        allDependencies.push(...deps);

        const hookRegs = await analyzeFileForHookRegistrations(file);
        for (const [className, classUsage] of Object.entries(hookRegs)) {
            if (!allHookRegistrations[className]) {
                allHookRegistrations[className] = {
                    properties: new Set(),
                    methods: new Set(),
                    nestedObjectUsage: new Set(),
                    fullExpressions: new Set(),
                    files: new Set(),
                    fromDirectAccess: false,
                    fromHookRegistration: true
                };
            }

            for (const method of Array.from(classUsage.methods)) {
                allHookRegistrations[className].methods.add(method);
            }
            for (const file of Array.from(classUsage.files)) {
                allHookRegistrations[className].files.add(path.relative(projectRoot, file));
            }
        }
    }

    const usage: GameHookUsage = {};

    for (const dep of allDependencies) {
        if (!usage[dep.hookName]) {
            usage[dep.hookName] = {
                properties: new Set(),
                methods: new Set(),
                nestedObjectUsage: new Set(),
                fullExpressions: new Set(),
                files: new Set(),
                fromDirectAccess: dep.isDirect,
                fromHookRegistration: false
            };
        }

        const hookUsage = usage[dep.hookName];
        hookUsage.files.add(path.relative(projectRoot, dep.file));
        hookUsage.fullExpressions.add(dep.fullExpression);
        
        // Update fromDirectAccess if we have direct access
        if (dep.isDirect) {
            hookUsage.fromDirectAccess = true;
        }

        // Only track direct class members, not nested object methods/properties
        if (dep.isDirect) {
            // For direct access, only track the immediate properties/methods of the hook class
            for (let i = 0; i < dep.propertyChain.length; i++) {
                const prop = dep.propertyChain[i];

                if (i === 0) {
                    // First level: direct static methods/properties or Instance
                    if (prop.includes('()')) {
                        hookUsage.methods.add(prop.replace('()', ''));
                    } else {
                        hookUsage.properties.add(prop);
                    }
                }
                else if (i === 1 && dep.propertyChain[0] === 'Instance') {
                    // Second level after Instance: direct instance properties/methods
                    if (prop.includes('()')) {
                        hookUsage.methods.add(prop.replace('()', ''));
                    } else {
                        hookUsage.properties.add(prop);
                    }
                }
                // Don't track deeper levels - they belong to nested objects, not the hook class
                else {
                    break;
                }
            }
        } else {
            // For indirect access, only track if it's directly calling the stored reference
            // Don't track nested object methods/properties
            if (dep.propertyChain.length <= 1) {
                // Only if accessing the variable directly (no additional properties/methods)
                const prop = dep.propertyChain[0];
                if (prop && prop.includes('()')) {
                    hookUsage.methods.add(prop.replace('()', ''));
                }
            }
            // Track all indirect usage for debugging purposes
            hookUsage.nestedObjectUsage.add(dep.fullExpression);
        }
    }

    for (const [className, classUsage] of Object.entries(allHookRegistrations)) {
        if (!usage[className]) {
            usage[className] = classUsage;
        } else {
            for (const method of Array.from(classUsage.methods)) {
                usage[className].methods.add(method);
            }
            for (const file of Array.from(classUsage.files)) {
                usage[className].files.add(file);
            }
            usage[className].fromHookRegistration = true;
        }
    }

    console.log("📊 GAME HOOKS DEPENDENCY ANALYSIS");
    console.log("=".repeat(50));

    for (const [hookName, hookUsage] of Object.entries(usage)) {
        console.log(`\n🎯 ${hookName}`);
        console.log("-".repeat(30));

        const sources: string[] = [];
        if (hookUsage.fromDirectAccess) sources.push("Direct Access");
        if (hookUsage.fromHookRegistration) sources.push("Hook Registration");
        console.log(`🔍 Found via: ${sources.join(", ")}`);

        console.log(`📁 Used in files: ${Array.from(hookUsage.files).join(', ')}`);

        if (hookUsage.properties.size > 0) {
            console.log(`📝 Properties: ${Array.from(hookUsage.properties).join(', ')}`);
        }

        if (hookUsage.methods.size > 0) {
            console.log(`⚡ Methods: ${Array.from(hookUsage.methods).join(', ')}`);
        }

        if (hookUsage.nestedObjectUsage.size > 0) {
            console.log(`🔗 Nested Object Usage: ${Array.from(hookUsage.nestedObjectUsage).join(', ')}`);
        }

        // Show detailed access patterns
        const directAccess = allDependencies.filter(dep => dep.hookName === hookName && dep.isDirect);
        const indirectAccess = allDependencies.filter(dep => dep.hookName === hookName && !dep.isDirect);

        if (directAccess.length > 0) {
            console.log(`📍 Direct Access (${directAccess.length} occurrences):`);
            directAccess.forEach(dep => {
                const fileName = path.basename(dep.file);
                console.log(`   • Line ${dep.line}: ${dep.fullExpression} (${fileName})`);
            });
        }

        if (indirectAccess.length > 0) {
            console.log(`🔗 Indirect Access (${indirectAccess.length} occurrences):`);
            indirectAccess.forEach(dep => {
                const fileName = path.basename(dep.file);
                const chainDescription = dep.propertyChain.length > 1 ? 
                    ` → ${dep.propertyChain.join('.')}` : '';
                console.log(`   • Line ${dep.line}: ${dep.fullExpression} via ${dep.sourceVariable}${chainDescription} (${fileName})`);
            });
        }
    }

    console.log(`\n🎮 ANALYZING GAME CLIENT CODE`);
    console.log("=".repeat(50));

    try {
        console.log("Fetching game client code...");
        const clientCode = await obtainGameClient(true);
        console.log(`Client code loaded: ${Math.round(clientCode.length / 1024)}KB`);

        console.log("Parsing client with acorn for class structures...");
        const clientClasses = await parseClientForClasses(clientCode);
        console.log(`Found ${clientClasses.length} potential classes in client`);

        console.log("\n📋 Example classes found:");
        clientClasses.slice(0, 5).forEach(cls => {
            console.log(`   ${cls.name}: ${cls.staticProperties.size} static props, ${cls.methods.size} methods, ${cls.properties.size} instance props`);
        });

        console.log(`\n🔍 DISCOVERING CLIENT CLASS NAMES`);
        console.log("=".repeat(50));

        for (const [mappedName, hookUsage] of Object.entries(usage)) {
            console.log(`\n🎯 Finding client class for: ${mappedName}`);

            const sources: string[] = [];
            if (hookUsage.fromDirectAccess) sources.push("Direct Access");
            if (hookUsage.fromHookRegistration) sources.push("Hook Registration");
            console.log(`   🔍 Found via: ${sources.join(", ")}`);

            if (hookUsage.properties.size > 0) {
                console.log(`   📝 Required properties: ${Array.from(hookUsage.properties).join(', ')}`);
            }
            if (hookUsage.methods.size > 0) {
                console.log(`   ⚡ Required methods: ${Array.from(hookUsage.methods).join(', ')}`);
            }

            // Show known class information if available
            const knownInfo = knownClassInfo.find(info => info.className === mappedName);
            if (knownInfo) {
                console.log(`   💡 Known class info available: ${knownInfo.description || 'No description'}`);
                if (knownInfo.properties && knownInfo.properties.length > 0) {
                    console.log(`   🔍 Known properties: ${knownInfo.properties.join(', ')}`);
                }
                if (knownInfo.methods && knownInfo.methods.length > 0) {
                    console.log(`   🔍 Known methods: ${knownInfo.methods.join(', ')}`);
                }
            }

            const existingMapping = classMappings.find(m => m.hookName === mappedName);
            if (existingMapping) {
                console.log(`   📋 Current mapping: ${mappedName} → ${existingMapping.clientClassName}`);

                const clientClass = clientClasses.find(c => c.name === existingMapping.clientClassName);
                if (clientClass) {
                    console.log(`   ✅ Current mapping is valid - class "${existingMapping.clientClassName}" found`);
                    results.push(`this.hookManager.registerClass("${existingMapping.clientClassName}", "${mappedName}");`);
                    continue;
                } else {
                    console.log(`   ❌ Current mapping is INVALID - class "${existingMapping.clientClassName}" not found`);
                    console.log(`   🔍 Searching for new match...`);
                }
            }

            const matches: ClassMatch[] = [];

            for (const clientClass of clientClasses) {
                const match = calculateMatchScore(hookUsage, clientClass, mappedName);

                if (match.matchScore > 0) {
                    matches.push(match);
                }
            }

            matches.sort((a, b) => b.matchScore - a.matchScore);

            if (matches.length > 0) {
                console.log(`   📈 Top matches:`);
                for (let i = 0; i < Math.min(3, matches.length); i++) {
                    const match = matches[i];
                    console.log(`      ${i + 1}. ${match.clientClassName} (score: ${match.matchScore})`);
                    if (match.matchedProperties.length > 0) {
                        console.log(`         ✅ Matched properties: ${match.matchedProperties.join(', ')}`);
                    }
                    if (match.matchedMethods.length > 0) {
                        console.log(`         ✅ Matched methods: ${match.matchedMethods.join(', ')}`);
                    }
                    if (match.missingProperties.length > 0) {
                        console.log(`         ❌ Missing properties: ${match.missingProperties.join(', ')}`);
                    }
                    if (match.missingMethods.length > 0) {
                        console.log(`         ❌ Missing methods: ${match.missingMethods.join(', ')}`);
                    }
                }

                const bestMatch = matches[0];
                if (bestMatch.matchScore >= 2) {
                    if (existingMapping && existingMapping.clientClassName !== bestMatch.clientClassName) {
                        results.push(`// UPDATE: this.hookManager.registerClass("${bestMatch.clientClassName}", "${mappedName}"); // was "${existingMapping.clientClassName}"`);
                        console.log(`   🎯 SUGGESTED UPDATE: this.hookManager.registerClass("${bestMatch.clientClassName}", "${mappedName}"); // was "${existingMapping.clientClassName}"`);
                    } else if (!existingMapping) {
                        results.push(`this.hookManager.registerClass("${bestMatch.clientClassName}", "${mappedName}");`);
                        console.log(`   🎯 SUGGESTED NEW: this.hookManager.registerClass("${bestMatch.clientClassName}", "${mappedName}");`);
                    }
                } else {
                    console.log(`   ⚠️  Best match score too low (${bestMatch.matchScore}), needs manual review`);
                }
            } else {
                console.log(`   ❌ No matches found in client code`);
                if (hookUsage.properties.size === 0 && hookUsage.methods.size === 0) {
                    console.log(`   💡 No requirements detected - this may be a lookup table or utility`);
                }
            }
        }

    } catch (error) {
        console.error("Error analyzing client code:", error.message);
    }

    return usage;
}

const results: string[] = [];

analyzeGameHookDependencies().then(() => {
    console.log(results.join("\n"));
}).catch(console.error);