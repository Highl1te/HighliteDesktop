import { parse, Node } from 'acorn';
import * as walk from 'acorn-walk';
import { HighliteResources } from '../utilities/resources';
import { HookManager } from '../managers/highlite/hookManager';
import { ClassInfo, EnumInfo, ClassSignature, EnumSignature, HookMap, HookEntries } from './signatures';
import { ClassSignatures, EnumSignatures } from './signatures';

// Define the hook reflector for mapping classes and statements
export class Reflector {

    // Define the source
    private static source: string;

    // Define the AST
    private static ast: Node;

    // Define the classes
    private static classes: ClassInfo[] = [];

    // Define the enums
    private static enums: EnumInfo[] = [];

    // Define the class hooks
    private static classHooks: HookMap = new Map();

    // Define the enum hooks
    private static enumHooks: HookMap = new Map();

    // Look the hooks from client source
    static async loadHooksFromSource(source : string): Promise<void> {

        // Bind the source
        Reflector.source = source;

        // Bind the AST
        Reflector.ast = parse(source, {
            ecmaVersion: 'latest',
            sourceType: 'module'
        }) as unknown as Node;

        // Bind the classes
        Reflector.extractClasses();

        // Bind the enums
        Reflector.extractEnums();

        // Load the hooks
        Reflector.findHooksBySignature();

        // Save the hooks
        await Reflector.saveHooks();
    }

    // Load the hooks from the database
    static async loadHooksFromDB(): Promise<void> {

        // Link the database
        const highliteResources = new HighliteResources();

        // Initialise
        await highliteResources.init();
        
        // Read from the client class hooks
        const clientClassHooks = await highliteResources.getItem<HookEntries>('clientClassHooks');

        // If we have stored enum hooks
        if (Array.isArray(clientClassHooks)) {

            // Rehydrate
            Reflector.classHooks = Reflector.deserializeHookEntries(clientClassHooks);
        }

        // Read from the client enum hooks
        const clientEnumHooks = await highliteResources.getItem<HookEnties>('clientEnumHooks');

        // If we have stored enum hooks
        if (Array.isArray(clientEnumHooks)) {

            // Rehydrate
            Reflector.enumHooks = Reflector.deserializeHookEntries(clientEnumHooks);
        }
    }

    // Save the hooks to the database
    private static async saveHooks(): Promise<void> {

        // Link the database
        const highliteResources = new HighliteResources();

        // Initialise
        await highliteResources.init();

        // Save the class hooks
        await highliteResources.setItem('clientClassHooks', Reflector.serializeHookMap(Reflector.classHooks));
        
        // Save the enum hooks
        await highliteResources.setItem('clientEnumHooks', Reflector.serializeHookMap(Reflector.enumHooks));    
    }

    // Check if we have any previously saved hooks
    static async hasSavedHooks(): Promise<boolean> {

        // Link the database
        const highliteResources = new HighliteResources();

        // Initialise
        await highliteResources.init();

        // Read the stored class hooks
        const clientClassHooks = await highliteResources.getItem<HookEntries>('clientClassHooks');

        // Read the stored enum hooks
        const clientEnumHooks = await highliteResources.getItem<HookEntries>('clientEnumHooks');

        // Return true if either collection has at least one entry
        const classCount = Array.isArray(clientClassHooks) ? clientClassHooks.length : 0;
        const enumCount = Array.isArray(clientEnumHooks) ? clientEnumHooks.length  : 0;

        return (classCount + enumCount) > 0;
    }

    // Extract the classes from the AST
    private static extractClasses() : ClassInfo[] {

        // Walk through the entire AST
        walk.simple(Reflector.ast, {

            // Handle class declarations
            ClassDeclaration(node : any) {

                // Define
                const c : ClassInfo = {
                    name: node.id ?.name ?? '',
                    staticFields: [],
                    instanceFields: [],
                    staticMethods: [],
                    instanceMethods: [],
                    start: node.start,
                    end: node.end
                };

                for (const m of node.body.body) {
                    if (m.type === 'MethodDefinition') {
                        const list = m.static
                            ? c.staticMethods
                            : c.instanceMethods;
                        list.push({name: m.key.name, kind: m.kind});
                    } else if (m.type === 'PropertyDefinition' || m.type === 'ClassProperty') {
                        const list = m.static
                            ? c.staticFields
                            : c.instanceFields;
                        list.push(m.key.name);
                    }
                }

                // Store the class
                Reflector.classes.push(c);
            }
        });
        return Reflector.classes;
    }

    // Extract the enums from the AST
    private static extractEnums() : EnumInfo[] {

        // Walk through the entire AST
        walk.simple(Reflector.ast, {

            // Pattern 1: !function(e){ ... }(E || (E = {}));
            CallExpression(node: any) {

                if (node.arguments.length !== 1) return;
                const arg = node.arguments[0];
                if (arg.type !== 'LogicalExpression' || arg.operator !== '||') return;
                if (arg.left.type !== 'Identifier') return;

                let assign;
                if (arg.right.type === 'AssignmentExpression') assign = arg.right;
                else if (arg.right.type === 'ParenthesizedExpression'
                    && arg.right.expression.type === 'AssignmentExpression')
                    assign = arg.right.expression;
                if (!assign) return;
                if (assign.left.type !== 'Identifier') return;
                if (assign.left.name !== arg.left.name) return;

                const callee = node.callee;
                if (callee.type !== 'FunctionExpression' && callee.type !== 'ArrowFunctionExpression') return;

                const memberSet = new Set<string>();
                walk.simple(callee.body, {
                    Literal(l: any) {
                        if (typeof l.value === 'string') memberSet.add(l.value);
                    }
                });

                if (!memberSet.size) return;

                const e: EnumInfo = {
                    name: arg.left.name,
                    members: Array.from(memberSet),
                    start: node.start,
                    end: node.end
                };

                Reflector.enums.push(e);
            }
        });

        // Return the enums
        return Reflector.enums;
    }

    // Find the hooks using the hook signatures
    private static findHooksBySignature() {

        // Iterate through each of the class hooks
        for (const [name, signature] of ClassSignatures) {

            // Attempt to resolve the hook
            const hook = Reflector.findClassBySignature(signature);

            // Check if we had success
            if (hook) {

                // Bind it to the hooks
                Reflector.classHooks.set(name, hook.name);

                // Log to console
                console.log(`[Reflector] Successfully matched ${name} as ${hook.name}`);
                
            } else console.error(`[Reflector] Unable to find ${name}`);
        }

        // Iterate through each of the enum hooks
        for (const [name, signature] of EnumSignatures) {

            // Attempt to resolve the hook
            const hook = Reflector.findEnumBySignature(signature);

            // Check if we had success
            if (hook) {

                // Bind it to the hooks
                Reflector.enumHooks.set(name, hook.name);

                // Log to console
                console.log(`[Reflector] Successfully matched ${name} as ${hook.name}`);

            } else console.error(`[Reflector] Unable to find ${name}`);
        }
    }

    // Find a class based on signature
    // NOTE: Keep this public so easier to develop hooks for new features
    static findClassBySignature(signature : ClassSignature) : ClassInfo | undefined {

        // Return the class with the required signature
        return Reflector.classes.find(c => {

            // If fields are set check them
            if (signature.fields) {

                // Return false if the fields aren't all matched
                const fieldSet = new Set([...c.staticFields, ...c.instanceFields]);
                if (!signature.fields.every(f => fieldSet.has(f))) return false;
            }

            // If methods are set check them
            if (signature.methods) {

                // Return false if the methods aren't all matched
                const methodSet = new Set([
                ...c.staticMethods.map(m => m.name),
                ...c.instanceMethods.map(m => m.name),
                ]);
                if (!signature.methods.every(m => methodSet.has(m))) return false;
            }

            // If the signature textual match is set
            if (signature.contains) {

                // Return false if the string doesn't contain the text
                if (Reflector.source.slice(c.start, c.end).indexOf(signature.contains) < 0) return false;
            }

            // Return true as all checks passed
            return true;
        });
    }

    // Function to find a statement by signature
    // NOTE: Keep this public so easier to develop hooks for new features
    static findEnumBySignature(signature: EnumSignature): EnumInfo | undefined {

        // Return the enum with the required signature
       return Reflector.enums.find(e => {

            // Return false if we can't find all the enum'sexpected fields
            if (!signature.includes.every(m => e.members.includes(m))) return false;

            // Return false if we have any of the excluded fileds
            if (signature.exclude && signature.exclude.some(x => e.members.includes(x))) return false;

            // Return true if all checks pass
            return true;
        });
    }

    // Get a hook from the registry
    static getClassHook(name: string): string | undefined {
        return Reflector.classHooks.get(name);
    }

    // Get a hook from the registry
    static getEnumHook(name: string): string | undefined {
        return Reflector.enumHooks.get(name);
    }

    // Bind the class hooks to the hook manager
    static bindClassHooks(hookManager: HookManager) {

        // Iterate through all the class hooks
        Array.from(Reflector.classHooks.entries()).forEach(([name, hook] : [string, string]) => {

            console.log(name, hook)

            // Register the class hook on the manager
            hookManager.registerClass(hook, name)
        });
    }

    // Bind the enum hooks to the hook manager
    static bindEnumHooks(hookManager: HookManager) {

        // Iterate through all the enum hooks
        Array.from(Reflector.enumHooks.entries()).forEach(([name, hook] : [string, string]) => {

            // Register the class hook on the manager
            hookManager.registerEnum(hook, name)
        });
    }

    // Convert a HookMap to its serializable tuple form
    private static serializeHookMap(map: HookMap): HookEntries {
        return Array.from(map.entries());
    }

    // Convert serialized entries back into a HookMap
    private static deserializeHookEntries(entries: HookEntries | null | undefined): HookMap {
        return new Map(entries ?? []);
    }
}
