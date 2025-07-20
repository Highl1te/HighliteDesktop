import { ClassSignature, EnumSignature } from './types';

// Define the map of all class hook signatures
export const ClassSignatures: [string, ClassSignature][] = [

    // Define all the class signatures
    ['EntityManager', { methods: ['CurrentOnlinePlayerCount', 'NPCs'] }],
    ['GroundItemManager', { methods: ['GroundItemCount'] }],
    ['MeshManager', { methods: ['getInstanceCountForMeshByFileName'] }],
    ['WorldMapManager', { methods: ['CurrentMapCenterCoordinates'] }],
    ['AtmosphereManager', { methods: ['_initializeEarthOverworldAtmosphere'] }],
    ['WorldEntityManager', { methods: ['WorldEntities'] }],
    ['SpellManager', { methods: ['CurrentlySelectedSpell'] }],
    ['SpellMeshManager', { methods: ['PendingMainPlayerTeleportEndSpellMesh'] }],
    ['GameLoop', { methods: ['startGameLoop'] }],
    ['ChatManager', { methods: ['Friends', 'LastPrivateMessageReceivedFrom'] }],
    ['RangeManager', { methods: ['handleEntityFiredProjectile'] }],
    ['SocketManager', { methods: ['openSocketConnection', 'emitPacket'] }],
    ['GameEngine', { methods: ['Scene', 'Engine', 'Canvas'] }],
    ['ItemManager', { methods: ['CurrentSelectedItem', 'IsItemCurrentlySelected'] }],
    ['LoginScreen', { methods: ['_createControl', '_createLoginMenu'] }],
    ['PrivateChatMessageList', { methods: ['getElement', 'getChatMessages'] }],
    ['InventoryManager', { methods: ['Items', 'IsWaitingForSwapItemConfirmation'] }],
    ['UIManager', { methods: ['Manager'] }],
    ['BankUIManager', { methods: ['_initializeBankMenu'] }],
    ['NameplateManager', { methods: ['getTextColorClassNameForEntityType'] }],
    ['InventoryItemSpriteManager', { methods: ['getSlot', 'getElement', 'updateAmountText'] }],
    ['SpriteSheetManager', { methods: ['ItemSpritesheetInfo'] }],
    ['GameCameraManager', { methods: ['initializeCamera'] }],
    ['ItemDefinitionManager', { methods: ['ItemDefMap'] }],
    ['NpcDefinitionManager', { methods: ['loadFromJSON', 'getDefById'], contains: '_npcDefMap' }],
    ['SpellDefinitionManager', { methods: ['loadFromJSON', 'getDefById'], contains: 'SpellDefs' }],
    ['AppearanceUtils', { methods: ['updateAppearance', 'doesAppearanceAndEquippedItemsMatch'] }],
    ['BlobLoader', { methods: ['SizeBytes', 'createObjectURL'] }],
    ['HTMLUIManager', { methods: ['getGameContainer'] }],
    ['ScreenMask', { methods: ['getForceDesktopModeControl'] }],
    ['ContextMenuManager', { methods: ['createContextMenu', 'createContextMenuItem'] }],
    ['TargetActionManager', { methods: ['getActionsAndEntitiesAtMousePointer'] }],
    ['MagicSkillManager', { methods: ['canCastSpellAtLevel'] }],
    ['SpellMenuManager', { methods: ['_handleAutoCastChanged', '_handlePendingSpellChanged'] }],
];

// Define the map of all class hook signatures
export const EnumSignatures: [string, EnumSignature][] = [
    
    // Define all the statement signatures
    ['GameWorldActions', { includes: ['attack', 'talk_to'] }],
    ['InventoryActions',  { includes: ['use', 'inspect', 'drop'] }],
    ['PlayerActions', { includes: ['IdleState', 'MovingState'] }],
    ['Skills', { includes: ['hitpoints', 'accuracy'] }],
    ['EntityTypes', { includes: ['Environment', 'Item'] }],
    ['AppearanceTypes', { includes: ['HairID', 'BeardID', 'ShirtID'], excludes: ['Username']}],
    ['UISettings', { includes: ['UITheme', 'IsGameWindowFullScreen'] }],
    ['GameInterfaces', { includes: ['Inventory', 'Bank', 'Shop'] } ],
    ['GameObjects', { includes: ['caveentrance', 'caveexit', 'oaktree'] }]
];
