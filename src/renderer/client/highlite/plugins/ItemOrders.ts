import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { PanelManager } from '../core/managers/highlite/panelManager';

export class ItemOrders extends Plugin {
	pluginName = 'Item Orders';
    author = 'Yoyo2324';
    private panelManager: PanelManager = new PanelManager();
    private panelStarted: boolean = false;
    private loginStatusUpdateId: undefined | ReturnType<typeof setInterval>;

    private panelContent: HTMLElement | null = null;
    private itemListContainer: HTMLDivElement | null = null;
    private orderInput: HTMLDivElement | null = null;
    private orderInputSkill: HTMLSelectElement | null = null;
    private orderInputCategory: HTMLSelectElement | null = null;
    private orderInputItem: HTMLSelectElement | null = null;
    private orderBtn: HTMLElement | null = null;
    private modalOverlay: HTMLDivElement | null = null;
    private isLoggedIn: boolean = false;
    private updateId: undefined | ReturnType<typeof setInterval>;

    constructor() {
        super();
        this.settings.recieveOrders = {
            text: 'Receive Orders',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //TODO
        };
    }

    start(): void {
    	this.log('Item Orders Panel started');
        if (!this.loginStatusUpdateId){
            this.loginStatusUpdateId = setInterval(() => {this.checkLoginStatus();}, 50);
        }
    }

    stop(): void {}

    init(): void {
        this.log('Item Orders Panel initialized');
    }

    SocketManager_loggedIn(): void {
        this.start();
    }

    private checkLoginStatus(): void {
        this.log("CHECK");
        if (!this.gameHooks.EntityManager.Instance.MainPlayer || !this.settings.enable.value || this.panelStarted) return;
        // Create the panel
        this.createPanel();
        this.addStyles();

        // Mark as logged in
        clearInterval(this.loginStatusUpdateId);
        this.isLoggedIn = true;
        this.panelStarted = true;
        this.buildPanelContent();
        this.addStyles();
        this.updateOrders();
        this.updateId = setInterval(() => {this.updateOrders();}, 30000);
    }

    SocketManager_handleLoggedOut(): void {
        // Mark as logged out
        this.isLoggedIn = false;

        // Close any open modal
        this.closeModal();

        // Reset loaded states
        this.itemsLoaded = false;

        // Show loading state
        this.showLoadingState();

        clearInterval(this.updateId);
        this.panelStarted = false;
        this.loginStatusUpdateId = setInterval(() => {this.checkLoginStatus();}, 50);
    }

    private createPanel(): void {
        try {
            // Request panel menu item
            const panelItems = this.panelManager.requestMenuItem(
                '🏛️',
                'Item Orders'
            );
            if (!panelItems) {
                this.error('Failed to create Item Orders panel menu item');
                return;
            }

            // Get the panel content area
            this.panelContent = panelItems[1] as HTMLElement;

            // Set up the panel
            this.panelContent.className = 'item-orders-panel';
            this.panelContent.style.width = '100%';
            this.panelContent.style.height = '100%';
            this.panelContent.style.display = 'flex';
            this.panelContent.style.flexDirection = 'column';

            // Build the panel content
            this.buildPanelContent();
            this.addStyles();
        } catch (error) {
            this.error(`Failed to create panel: ${error}`);
        }
    }

    private buildPanelContent(): void {
        if (!this.panelContent) return;

        this.panelContent.innerHTML = '';

        // Create search bar
        const orderContainer = document.createElement('div');
        orderContainer.className = 'item-orders-request-container';
        this.panelContent.appendChild(orderContainer);

        this.orderInput = document.createElement('div');
        this.orderInput.className = 'item-orders-order-input-container';
        this.orderInput.innerHTML = `
            <h3>Request items:</h3>
        `;
        this.orderInputSkill = document.createElement('select');
        this.orderInputSkill.name = 'orderSkill';
        this.orderInputSkill.id = 'orderSkill';
        this.orderInputSkill.innerHTML = `
            <option value ="accuracy">Accuracy</option>
            <option value ="strength">Strength</option>
            <option value ="defence">Defence</option>
            <option value ="magic">Magic</option>
            <option value ="range">Range</option>
            <option value ="cooking">Cooking</option>
            <option value ="crafting">Crafting</option>
            <option value ="crime">Crime</option>
            <option value ="enchanting">Enchanting</option>
            <option value ="fishing">Fishing</option>
            <option value ="forestry">Forestry</option>
            <option value ="harvesting">Harvesting</option>
            <option value ="mining">Mining</option>
            <option value ="potionmaking">Potionmaking</option>
            <option value ="smithing">Smithing</option>
        `;
        this.orderInputSkill.onchange = () => this.updateOrderCategoryInput();

        this.orderInputCategory = document.createElement('select');
        this.orderInputCategory.name = 'orderCategory';
        this.orderInputCategory.id = 'orderCategory';
        this.orderInputCategory.innerHTML = `
                <option value ="accuracyEquipment">Equipment</option>
        `;
        this.orderInputCategory.onchange = () => this.updateOrderItemInput();

        this.orderInputItem = document.createElement('select');
        this.orderInputItem.name = 'orderCategory';
        this.orderInputItem.id = 'orderCategory';
        this.orderInputItem.innerHTML = `
                <option value ="bronzeScimitar">Bronze Scimitar</option>
                <option value ="bronzeLongsword">Bronze Longsword</option>
                <option value ="bronzeBattleaxe">Bronze Battleaxe</option>
                <option value ="bronzeGreatsword">Bronze Greatsword</option>
                <option value ="ironScimitar">Iron Scimitar</option>
                <option value ="ironLongsword">Iron Longsword</option>
                <option value ="ironBattleaxe">Iron Battleaxe</option>
                <option value ="ironGreatsword">Iron Greatsword</option>
                <option value ="steelScimitar">Steel Scimitar</option>
                <option value ="steelLongsword">Steel Longsword</option>
                <option value ="steelBattleaxe">Steel Battleaxe</option>
                <option value ="steelGreatsword">Steel Greatsword</option>
                <option value ="palladiumScimitar">Palladium Scimitar</option>
                <option value ="palladiumLongsword">Palladium Longsword</option>
                <option value ="palladiumBattleaxe">Palladium Battleaxe</option>
                <option value ="palladiumGreatsword">Palladium Greatsword</option>
                <option value ="coroniumScimitar">Coronium Scimitar</option>
                <option value ="coroniumLongsword">Coronium Longsword</option>
                <option value ="coroniumBattleaxe">Coronium Battleaxe</option>
                <option value ="coroniumGreatsword">Coronium Greatsword</option>
                <option value ="celadonScimitar">Celadon Scimitar</option>
                <option value ="celadonLongsword">Celadon Longsword</option>
                <option value ="celadonBattleaxe">Celadon Battleaxe</option>
                <option value ="celadonGreatsword">Celadon Greatsword</option>
                <option value ="legendaryScimitar">Legendary Scimitar</option>
                <option value ="legendaryLongsword">Legendary Longsword</option>
                <option value ="legendaryBattleaxe">Legendary Battleaxe</option>
        `;

        let amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.name = 'amount';
        amountInput.id = 'orderAmount';
        amountInput.placeholder = 'Amount';

        let priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.name = 'price';
        priceInput.id = 'orderPrice';
        priceInput.placeholder = 'Price (per item)';

        this.orderInput.appendChild(this.orderInputSkill);
        this.orderInput.appendChild(this.orderInputCategory);
        this.orderInput.appendChild(this.orderInputItem);
        this.orderInput.appendChild(amountInput);
        this.orderInput.appendChild(priceInput);

        this.orderBtn = document.createElement('button');
        this.orderBtn.textContent = 'Submit Order';
        this.orderBtn.onclick = () => this.submitOrder();
        this.orderInput.appendChild(this.orderBtn);
        orderContainer.appendChild(this.orderInput);

        // Create item list container wrapper
        const listWrapper = document.createElement('div');
        listWrapper.className = 'item-panel-list-wrapper';
        this.panelContent.appendChild(listWrapper);

        this.itemListContainer = document.createElement('div');
        this.itemListContainer.className = 'items-orders-list-container';
        listWrapper.appendChild(this.itemListContainer);

        // Show loading state initially
        this.showLoadingState();
    }

    private updateOrderCategoryInput(): void {
        if (!this.orderInputSkill || !this.orderInputCategory) return;
        this.log(this.orderInputSkill.value);
        switch (this.orderInputSkill.value) {
            case "accuracy": {
                this.orderInputCategory.innerHTML = `
                    <option value ="accuracyEquipment">Equipment</option>
                `;
                break;
            }
            case "strength": {
                this.orderInputCategory.innerHTML = `
                    <option value ="strengthEquipment">Equipment</option>
                `;
                break;
            }
            case "defence": {
                this.orderInputCategory.innerHTML = `
                    <option value ="defenceEquipment">Equipment</option>
                `;
                break;
            }
            case "magic": {
                this.orderInputCategory.innerHTML = `
                    <option value ="magicEquipment">Equipment</option>
                `;
                break;
            }
            case "range": {
                this.orderInputCategory.innerHTML = `
                    <option value ="arrows">Arrows</option>
                    <option value ="bows">Bows</option>
                    <option value ="rangeEquipment">Equipment</option>
                `;
                break;
            }
            case "cooking": {
                this.orderInputCategory.innerHTML = `
                    <option value ="fish">Fish</option>
                    <option value ="meat">Meat</option>
                    <option value ="vegetables">Vegetables</option>
                `;
                break;
            }
            case "crafting": {
                this.orderInputCategory.innerHTML = `
                    <option value ="armour">Armour</option>
                    <option value ="craftingArrows">Arrows</option>
                    <option value ="craftingBows">Bows</option>
                    <option value ="gems">Gems</option>
                    <option value ="jewelry">Jewelry</option>
                    <option value ="craftingScrolls">scrolls</option>
                    <option value ="spinningWheel">Spinning Wheel</option>
                `;
                break;
            }
            case "crime": {
                this.orderInputCategory.innerHTML = `
                    <option value ="crimeEquipment">Equipment</option>
                `;
                break;
            }
            case "enchanting": {
                this.orderInputCategory.innerHTML = `
                    <option value ="enchantingScrolls">Scrolls</option>
                `;
                break;
            }
            case "fishing": {
                this.orderInputCategory.innerHTML = `
                    <option value ="basicRod">Basic Rod</option>
                    <option value ="greatRod">Great Rod</option>
                    <option value ="ultraRod">Ultra Rod</option>
                    <option value ="masterRod">Master Rod</option>
                `;
                break;
            }
            case "forestry": {
                this.orderInputCategory.innerHTML = `
                    <option value ="Trees">Trees</option>
                    <option value ="forestryEquipment">Equipment</option>
                `;
                break;
            }
            case "harvesting": {
                this.orderInputCategory.innerHTML = `
                    <option value ="resources">Resources</option>
                    <option value ="treeShaking">Tree Shaking</option>
                    <option value ="harvestingEquipment">Equipment</option>
                `;
                break;
            }
            case "mining": {
                this.orderInputCategory.innerHTML = `
                    <option value ="rocks">Rocks</option>
                    <option value ="miningEquipment">Equipment</option>
                `;
                break;
            }
            case "potionmaking": {
                this.orderInputCategory.innerHTML = `
                    <option value ="potions">Potions</option>
                `;
                break;
            }
            case "smithing": {
                this.orderInputCategory.innerHTML = `
                    <option value ="bars">Bars</option>
                    <option value ="weaponry">Weaponry</option>
                    <option value ="helmets">Helmets</option>
                    <option value ="bodyArmour">Body Armour</option>
                    <option value ="legArmour">Leg Armour</option>
                    <option value ="shields">Shields</option>
                    <option value ="gloves">Gloves</option>
                    <option value ="tools">Tools</option>
                    <option value ="miscellaneous">Miscellaneous</option>
                `;
                break;
            }
        }
        this.updateOrderItemInput();
    }

    private updateOrderItemInput(): void {
        console.log("TESTING");
        if (!this.orderInputCategory || !this.orderInputItem) return;

        switch (this.orderInputCategory.value) {
            case "accuracyEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeScimitar">Bronze Scimitar</option>
                    <option value ="bronzeLongsword">Bronze Longsword</option>
                    <option value ="bronzeBattleaxe">Bronze Battleaxe</option>
                    <option value ="bronzeGreatsword">Bronze Greatsword</option>
                    <option value ="ironScimitar">Iron Scimitar</option>
                    <option value ="ironLongsword">Iron Longsword</option>
                    <option value ="ironBattleaxe">Iron Battleaxe</option>
                    <option value ="ironGreatsword">Iron Greatsword</option>
                    <option value ="steelScimitar">Steel Scimitar</option>
                    <option value ="steelLongsword">Steel Longsword</option>
                    <option value ="steelBattleaxe">Steel Battleaxe</option>
                    <option value ="steelGreatsword">Steel Greatsword</option>
                    <option value ="palladiumScimitar">Palladium Scimitar</option>
                    <option value ="palladiumLongsword">Palladium Longsword</option>
                    <option value ="palladiumBattleaxe">Palladium Battleaxe</option>
                    <option value ="palladiumGreatsword">Palladium Greatsword</option>
                    <option value ="coroniumScimitar">Coronium Scimitar</option>
                    <option value ="coroniumLongsword">Coronium Longsword</option>
                    <option value ="coroniumBattleaxe">Coronium Battleaxe</option>
                    <option value ="coroniumGreatsword">Coronium Greatsword</option>
                    <option value ="celadonScimitar">Celadon Scimitar</option>
                    <option value ="celadonLongsword">Celadon Longsword</option>
                    <option value ="celadonBattleaxe">Celadon Battleaxe</option>
                    <option value ="celadonGreatsword">Celadon Greatsword</option>
                    <option value ="legendaryScimitar">Legendary Scimitar</option>
                    <option value ="legendaryLongsword">Legendary Longsword</option>
                    <option value ="legendaryBattleaxe">Legendary Battleaxe</option>
                `;
                break;
            }
            case "strengthEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="blackLeatherGloves">Black Leather Gloves</option>
                    <option value ="barbarianHelm">Barbarian Helm</option>
                    <option value ="knightsCape">Knight's Cape</option>
                    <option value ="championsCape">Champion's Cape</option>
                `;
                break;
            }
            case "defenceEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeHelm">Bronze Helm</option>
                    <option value ="bronzeFullHelm">Bronze Full Helm</option>
                    <option value ="bronzeShield">Bronze Shield</option>
                    <option value ="bronzePlateLegs">Bronze Platelegs</option>
                    <option value ="bronzeChainbody">Bronze Chainbody</option>
                    <option value ="bronzePlatebody">Bronze Platebody</option>
                    <option value ="ironHelm">Iron Helm</option>
                    <option value ="ironFullHelm">Iron Full Helm</option>
                    <option value ="ironShield">Iron Shield</option>
                    <option value ="ironPlateLegs">Iron Platelegs</option>
                    <option value ="ironChainbody">Iron Chainbody</option>
                    <option value ="ironPlatebody">Iron Platebody</option>
                    <option value ="silverWarriorHelmet">Silver Warrior Helmet</option>
                    <option value ="steelHelm">Steel Helm</option>
                    <option value ="steelFullHelm">Steel Full Helm</option>
                    <option value ="steelShield">Steel Shield</option>
                    <option value ="steelPlateLegs">Steel Platelegs</option>
                    <option value ="steelChainbody">Steel Chainbody</option>
                    <option value ="steelPlatebody">Steel Platebody</option>
                    <option value ="goldWarriorHelmet">Gold Warrior Helmet</option>
                    <option value ="palladiumHelm">Palladium Helm</option>
                    <option value ="palladiumFullHelm">Palladium Full Helm</option>
                    <option value ="palladiumShield">Palladium Shield</option>
                    <option value ="palladiumPlateLegs">Palladium Platelegs</option>
                    <option value ="palladiumChainbody">Palladium Chainbody</option>
                    <option value ="palladiumPlatebody">Palladium Platebody</option>
                    <option value ="coroniumHelm">Coronium Helm</option>
                    <option value ="coroniumFullHelm">Coronium Full Helm</option>
                    <option value ="coroniumShield">Coronium Shield</option>
                    <option value ="coroniumPlateLegs">Coronium Platelegs</option>
                    <option value ="coroniumChainbody">Coronium Chainbody</option>
                    <option value ="coroniumPlatebody">Coronium Platebody</option>
                    <option value ="coroniumHelmSilver">Coronium Helm (S)</option>
                    <option value ="coroniumFullHelmSilver">Coronium Full Helm (S)</option>
                    <option value ="coroniumShieldSilver">Coronium Shield (S)</option>
                    <option value ="coroniumPlateLegsSilver">Coronium Platelegs (S)</option>
                    <option value ="coroniumChainbodySilver">Coronium Chainbody (S)</option>
                    <option value ="coroniumPlatebodySilver">Coronium Platebody (S)</option>
                    <option value ="coroniumHelmGold">Coronium Helm (G)</option>
                    <option value ="coroniumFullHelmGold">Coronium Full Helm (G)</option>
                    <option value ="coroniumShieldGold">Coronium Shield (G)</option>
                    <option value ="coroniumPlateLegsGold">Coronium Platelegs (G)</option>
                    <option value ="coroniumChainbodyGold">Coronium Chainbody (G)</option>
                    <option value ="coroniumPlatebodyGold">Coronium Platebody (G)</option>
                    <option value ="helmetMagic">Helmet of Magic</option>
                    <option value ="helmetMelee">Helmet of Melee</option>
                    <option value ="helmetRanging">Helmet of Ranging</option>
                    <option value ="celadonHelm">Celadon Helm</option>
                    <option value ="celadonFullHelm">Celadon Full Helm</option>
                    <option value ="celadonShield">Celadon Shield</option>
                    <option value ="celadonPlateLegs">Celadon Platelegs</option>
                    <option value ="celadonChainbody">Celadon Chainbody</option>
                    <option value ="celadonPlatebody">Celadon Platebody</option>
                    <option value ="celadonHelmSilver">Celadon Helm (S)</option>
                    <option value ="celadonFullHelmSilver">Celadon Full Helm (S)</option>
                    <option value ="celadonShieldSilver">Celadon Shield (S)</option>
                    <option value ="celadonPlateLegsSilver">Celadon Platelegs (S)</option>
                    <option value ="celadonChainbodySilver">Celadon Chainbody (S)</option>
                    <option value ="celadonPlatebodySilver">Celadon Platebody (S)</option>
                    <option value ="celadonHelmGold">Celadon Helm (G)</option>
                    <option value ="celadonFullHelmGold">Celadon Full Helm (G)</option>
                    <option value ="celadonShieldGold">Celadon Shield (G)</option>
                    <option value ="celadonPlateLegsGold">Celadon Platelegs (G)</option>
                    <option value ="celadonChainbodyGold">Celadon Chainbody (G)</option>
                    <option value ="celadonPlatebodyGold">Celadon Platebody (G)</option>
                    <option value ="legendaryShield">Legendary Shield</option>
                `;
                break;
            }
            case "magicEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="witchsHat">Witch's Hat</option>
                    <option value ="witchsBottoms">Witch's Bottoms</option>
                    <option value ="witchsTop">Witch's Top</option>
                    <option value ="wizardsHat">Wizard's Hat</option>
                    <option value ="wizardsGloves">Wizard's Gloves</option>
                    <option value ="wizardsBottoms">Wizard's Bottoms</option>
                    <option value ="wizardsBoots">Wizard's Boots</option>
                    <option value ="wizardsTop">Wizard's Top</option>
                    <option value ="blueWizardsHat">Blue Wizard's Hat</option>
                    <option value ="blueWizardsGloves">Blue Wizard's Gloves</option>
                    <option value ="blueWizardsBottoms">Blue Wizard's Bottoms</option>
                    <option value ="blueWizardsBoots">Blue Wizard's Boots</option>
                    <option value ="blueWizardsTop">Blue Wizard's Top</option>
                    <option value ="bloodHood">Blood Hood</option>
                    <option value ="bloodHat">Blood Hat</option>
                    <option value ="bloodGloves">Blood Gloves</option>
                    <option value ="bloodRobeBottoms">Blood Robe Bottoms</option>
                    <option value ="bloodRobeTop">Blood Robe Top</option>
                    <option value ="staff">Staff</option>
                    <option value ="emberStaff">Ember Staff</option>
                    <option value ="forestStaff">Forest Staff</option>
                    <option value ="hydroStaff">Hydro Staff</option>
                    <option value ="damoguisStaff">Damogui's Staff</option>
                `;
                break;
            }
            case "rangeEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="archersBoots">Archer's Boots</option>
                    <option value ="archersGloves">Archer's Gloves</option>
                `;
                break;
            }
            case "fish": {
                this.orderInputItem.innerHTML = `
                    <option value ="bass">Bass</option>
                    <option value ="bluegill">Bluegill</option>
                    <option value ="salmon">Salmon</option>
                    <option value ="carp">Carp</option>
                    <option value ="stingray">Stingray</option>
                    <option value ="piranha">Piranha</option>
                    <option value ="walleye">Walleye</option>
                    <option value ="crab">Crab</option>
                    <option value ="koi">Koi</option>
                    <option value ="tuna">Tuna</option>
                    <option value ="marlin">Marlin</option>
                    <option value ="frog">Frog</option>
                    <option value ="turtle">Turtle</option>
                    <option value ="clownfish">Clownfish</option>
                    <option value ="whaleshark">Whaleshark</option>
                    <option value ="octopus">Octopus</option>
                `;
                break;
            }
            case "meat": {
                this.orderInputItem.innerHTML = `
                    <option value ="rodentMeat">Rodent Meat</option>
                    <option value ="chicken">Chicken</option>
                    <option value ="steak">Steak</option>
                    <option value ="gameMeat">Game Meat</option>
                `;
                break;
            }
            case "vegetables": {
                this.orderInputItem.innerHTML = `
                    <option value ="bakedPotato">Baked Potato</option>
                    <option value ="grilledCorn">grilledCorn</option>
                `;
                break;
            }
            case "armour": {
                this.orderInputItem.innerHTML = `
                    <option value ="leatherGloves">Leather Gloves</option>
                    <option value ="leaatherBracers">Leather Bracers</option>
                    <option value ="leatherBoots">Leather Boots</option>
                    <option value ="leatherChaps">Leather Chaps</option>
                    <option value ="leatherBodyArmour">Leather Body Armour</option>
                    <option value ="plainsDragonleatherBracers">Plains Dragonleather Bracers</option>
                    <option value ="plainsDragonleatherChaps">Plains Dragonleather Bracers</option>
                    <option value ="waterDragonleatherBracers">Water Dragonleather Bracers</option>
                    <option value ="waterDragonleatherChaps">Water Dragonleather Bracers</option>
                    <option value ="fireDragonleatherBracers">Fire Dragonleather Bracers</option>
                    <option value ="fireDragonleatherChaps">Fire Dragonleather Bracers</option>
                `;
                break;
            }
            case "craftingArrows": {
                this.orderInputItem.innerHTML = `
                    <option value ="arrowShafts">Arrow Shafts</option>
                    <option value ="headlessArrows">Headless Arrows</option>
                    <option value ="bronzeArrows">Bronze Arrows</option>
                    <option value ="ironArrows">Iron Arrows</option>
                    <option value ="steelArrows">Steel Arrows</option>
                    <option value ="palladiumArrows">Palladium Arrows</option>
                    <option value ="coroniumArrows">Coronium Arrows</option>
                    <option value ="celadonArrows">Celadon Arrows</option>
                `;
                break;
            }
            case "craftingBows": {
                this.orderInputItem.innerHTML = `
                    <option value ="unstrungBow">Unstrung Bow</option>
                    <option value ="woodenBow">Wooden Bow</option>
                    <option value ="unstrungPineBow">Unstrung Pine Bow</option>
                    <option value ="pineBow">Pine Bow</option>
                    <option value ="unstrungOakBow">Unstrung Oak Bow</option>
                    <option value ="oakBow">oakBow</option>
                    <option value ="unstrungPalmBow">Unstrung Palm Bow</option>
                    <option value ="palmBow">Palm Bow</option>
                    <option value ="unstrungCherryBow">Unstrung Cherry Bow</option>
                    <option value ="cherryBow">Cherry Bow</option>
                    <option value ="unstrungWizardsBow">Unstrung Wizard's Bow</option>
                    <option value ="wizardsBow">Wizard's Bow</option>
                    <option value ="unstrungDeadwoodBow">Unstrung Deadwood Bow</option>
                    <option value ="deadwoodBow">Deadwood Bow</option>
                `;
                break;
            }
            case "gems": {
                this.orderInputItem.innerHTML = `
                    <option value ="roughAmethyst">Rough Amethyst</option>
                    <option value ="amethystGem">Amethyst Gem</option>
                    <option value ="roughSapphire">Rough Sapphire</option>
                    <option value ="sapphireGem">Sapphire Gem</option>
                    <option value ="roughEmerald">Rough Emerald</option>
                    <option value ="emeraldGem">Emerald Gem</option>
                    <option value ="roughTopaz">Rough Topaz</option>
                    <option value ="topazGem">Topaz Gem</option>
                    <option value ="roughCitrine">Rough Citrine</option>
                    <option value ="citrineGem">Citrine Gem</option>
                    <option value ="roughRuby">Rough Ruby</option>
                    <option value ="rubyGem">Ruby Gem</option>
                    <option value ="roughDiamond">Rough Diamond</option>
                    <option value ="diamondGem">Diamond Gem</option>
                    <option value ="roughCarbonado">Rough Carbonado</option>
                    <option value ="carbonadoGem">Carbonado Gem</option>
                `;
                break;
            }
            case "jewelry": {
                this.orderInputItem.innerHTML = `
                    <option value ="monksNecklace">Monk's Necklace</option>
                    <option value ="amethystNecklace">Amethyst Necklace</option>
                    <option value ="goldAmethystNecklace">Gold Amethyst Necklace</option>
                    <option value ="sapphireNecklace">Sapphire Necklace</option>
                    <option value ="goldSapphireNecklace">Gold Sapphire Necklace</option>
                    <option value ="emeraldNecklace">Emerald Necklace</option>
                    <option value ="goldEmeraldNecklace">Gold Emerald Necklace</option>
                    <option value ="topazNecklace">Topaz Necklace</option>
                    <option value ="goldTopazNecklace">Gold Topaz Necklace</option>
                    <option value ="citrineNecklace">Citrine Necklace</option>
                    <option value ="goldCitrineNecklace">Gold Citrine Necklace</option>
                    <option value ="rubyNecklace">Ruby Necklace</option>
                    <option value ="goldRubyNecklace">Gold Ruby Necklace</option>
                    <option value ="diamondNecklace">Diamond Necklace</option>
                    <option value ="goldDiamondNecklace">Gold Diamond Necklace</option>
                    <option value ="carbonadoNecklace">Carbonado Necklace</option>
                    <option value ="goldCarbonadoNecklace">Gold Carbonado Necklace</option>
                `;
                break;
            }
            case "craftingScrolls": {
                this.orderInputItem.innerHTML = `
                    <option value ="scroll">Scroll</option>
                    <option value ="pineScroll">Pine Scroll</option>
                    <option value ="oakScroll">Oak Scroll</option>
                    <option value ="palmScroll">Palm Scroll</option>
                    <option value ="sakuraScroll">Sakura Scroll</option>
                    <option value ="wizardScroll">Wizard Scroll</option>
                    <option value ="luckyScroll">Lucky Scroll</option>
                    <option value ="deadwoodScroll">Deadwood Scroll</option>
                `;
                break;
            }
            case "spinningWheel": {
                this.orderInputItem.innerHTML = `
                    <option value ="string">String</option>
                `;
                break;
            }
            case "crimeEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="banditMask">Bandit Mask</option>
                    <option value ="blackLeatherGloves">Black Leather Gloves</option>
                `;
                break;
            }
            case "enchantingScrolls": {
                this.orderInputItem.innerHTML = `
                    <option value ="waterScroll">Water Scroll</option>
                    <option value ="natureScroll">Nature Scroll</option>
                    <option value ="fireScroll">Fire Scroll</option>
                    <option value ="furyScroll">Fury Scroll</option>
                    <option value ="energyScroll">Energy Scroll</option>
                    <option value ="rageScroll">Rage Scroll</option>
                    <option value ="alchemyScroll">Alchemy Scroll</option>
                    <option value ="warpScroll">Warp Scroll</option>
                    <option value ="magicScroll">Magic Scroll</option>
                    <option value ="bloodScroll">Blood Scroll</option>
                `;
                break;
            }
            case "basicRod": {
                this.orderInputItem.innerHTML = `
                    <option value ="rawBass">Raw Bass</option>
                    <option value ="rawBluegill">Raw Bluegill</option>
                    <option value ="rawSalmon">Raw Salmon</option>
                    <option value ="rawTuna">Raw Tuna</option>
                `;
                break;
            }
            case "greatRod": {
                this.orderInputItem.innerHTML = `
                    <option value ="rawCarp">Raw Carp</option>
                    <option value ="rawStingray">Raw Stingray</option>
                    <option value ="rawPiranha">Raw Piranha</option>
                    <option value ="rawMarlin">Raw Marlin</option>
                `;
                break;
            }
            case "ultraRod": {
                this.orderInputItem.innerHTML = `
                    <option value ="rawWalleye">Raw Walleye</option>
                    <option value ="rawCrab">Raw Crab</option>
                    <option value ="rawKoi">rawKoi</option>
                    <option value ="rawWhaleshark">rawWhaleshark</option>
                `;
                break;
            }
            case "masterRod": {
                this.orderInputItem.innerHTML = `
                    <option value ="rawFrog">Raw Frog</option>
                    <option value ="rawTurtle">Raw Turtle</option>
                    <option value ="rawClownfish">Raw Clownfish</option>
                    <option value ="rawOctopus">Raw Octopus</option>
                `;
                break;
            }
            case "trees": {
                this.orderInputItem.innerHTML = `
                    <option value ="logs">Logs</option>
                    <option value ="pineLogs">Pine Logs</option>
                    <option value ="oakLogs">Oak Logs</option>
                    <option value ="palmLogs">Palm Logs</option>
                    <option value ="cherryLogs">Cherry Logs</option>
                    <option value ="luckyLogs">Lucky Logs</option>
                    <option value ="wizardLogs">Wizard Logs</option>
                    <option value ="deadwoodLogs">Deadwood Logs</option>
                `;
                break;
            }
            case "forestryEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeHatchet">Bronze Hatchet</option>
                    <option value ="ironHatchet">Iron Hatchet</option>
                    <option value ="steelHatchet">Steel Hatchet</option>
                    <option value ="palladiumHatchet">Palladium Hatchet</option>
                    <option value ="coroniumHatchet">Coronium Hatchet</option>
                    <option value ="celadonHatchet">Celadon Hatchet</option>
                `;
                break;
            }
            case "resources": {
                this.orderInputItem.innerHTML = `
                    <option value ="flax">Flax</option>
                    <option value ="potato">Potato</option>
                    <option value ="wheat">Wheat</option>
                    <option value ="carrot">Carrot</option>
                    <option value ="corn">Corn</option>
                    <option value ="tomato">Tomato</option>
                    <option value ="onion">Onion</option>
                    <option value ="redMushroom">Red Mushroom</option>
                    <option value ="strawberry">Strawberry</option>
                    <option value ="watermelon">Watermelon</option>
                    <option value ="pumpkin">Pumpkin</option>
                    <option value ="grapes">Grapes</option>
                    <option value ="rose">Rose</option>
                    <option value ="arubaRoot">Aruba Root</option>
                    <option value ="fijiRoot">Fiji Root</option>
                    <option value ="sardinianRoot">Sardinian Root</option>
                    <option value ="mauiRoot">Maui Root</option>
                    <option value ="grenadaRoot">Grenada Root</option>
                    <option value ="tongaRoot">Tonga Root</option>
                    <option value ="nauruRoot">Nauru Root</option>
                    <option value ="samoanRoot">Samoan Root</option>
                    <option value ="vanuaRoot">Vanua Root</option>
                    <option value ="marianaRoot">Mariana Root</option>
                `;
                break;
            }
            case "treeShaking": {
                this.orderInputItem.innerHTML = `
                    <option value ="leaf">Leaf</option>
                    <option value ="goldenLeaf">Golden Leaf</option>
                    <option value ="pinecone">Pinecone</option>
                    <option value ="goldenPinecone">Golden Pinecone</option>
                    <option value ="acorn">Acorn</option>
                    <option value ="goldenAcorn">Golden Acorn</option>
                    <option value ="coconut">Coconut</option>
                    <option value ="goldenCoconut">Golden Coconut</option>
                    <option value ="cherryBlossom">Cherry Blossom</option>
                    <option value ="goldenCherryBlossom">Golden Cherry Blossom</option>
                `;
                break;
            }
            case "harvestingEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeGloves">Bronze Gloves</option>
                    <option value ="ironGloves">Iron Gloves</option>
                    <option value ="steelGloves">Steel Gloves</option>
                    <option value ="palladiumGloves">Palladium Gloves</option>
                    <option value ="coroniumGloves">Coronium Gloves</option>
                    <option value ="silverCoroniumGloves">Coronium Gloves (S)</option>
                    <option value ="goldCoroniumGloves">Coronium Gloves (G)</option>
                    <option value ="celadonGloves">Celadon Gloves</option>
                    <option value ="silverCeladonGloves">Celadon Gloves (S)</option>
                    <option value ="goldCeladonGloves">Celadon Gloves (G)</option>
                    <option value ="legendaryGloves">Legendary Gloves</option>
                `;
                break;
            }
            case "rocks": {
                this.orderInputItem.innerHTML = `
                    <option value ="copperOre">Copper Ore</option>
                    <option value ="tinOre">Tin Ore</option>
                    <option value ="ironOre">Iron Ore</option>
                    <option value ="coal">Coal</option>
                    <option value ="silverNugget">Silver Nugger</option>
                    <option value ="palladiumOre">Palladium Ore</option>
                    <option value ="goldNugget">Gold Nugget</option>
                    <option value ="coroniumOre">Coronium Ore</option>
                    <option value ="celadiumOre">Celadium Ore</option>
                `;
                break;
            }
            case "miningEquipment": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzePickaxe">Bronze Pickaxe</option>
                    <option value ="ironPickaxe">Iron Pickaxe</option>
                    <option value ="steelPickaxe">Steel Pickaxe</option>
                    <option value ="palladiumPickaxe">Palladium Pickaxe</option>
                    <option value ="coroniumPickaxe">Coronium Pickaxe</option>
                    <option value ="celadonPickaxe">Celadon Pickaxe</option>
                `;
                break;
            }
            case "potions": {
                this.orderInputItem.innerHTML = `
                    <option value ="accuracyPotion">Potion of Accuracy</option>
                    <option value ="forestryPotion">Potion of Forestry</option>
                    <option value ="fishingPotion">Potion of Fishing</option>
                    <option value ="miningPotion">Potion of Mining</option>
                    <option value ="defensePotion">Potion of Defense</option>
                    <option value ="smithingPotion">Potion of Smithing</option>
                    <option value ="restorationPotion">Potion of Restoration</option>
                    <option value ="strengthPotion">Potion of Strength</option>
                    <option value ="mischiefPotion">Potion of Mischief</option>
                    <option value ="magicPotion">Potion of Magic</option>
                `;
                break;
            }
            case "bars": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeBar">Bronze Bar</option>
                    <option value ="ironBar">Iron Bar</option>
                    <option value ="pigIronBar">Pig Iron Bar</option>
                    <option value ="steelBar">Steel Bar</option>
                    <option value ="sliverBar">Silver Bar</option>
                    <option value ="palladiumBar">Palladium Bar</option>
                    <option value ="goldBar">Gold Bar</option>
                    <option value ="coroniumBar">Coronium Bar</option>
                    <option value ="celadiumBar">Celadium Bar</option>
                `;
                break;
            }
            case "miscellaneous": {
                this.orderInputItem.innerHTML = `
                    <option value ="bronzeArrowheads">Bronze Arrowheads</option>
                    <option value ="ironArrowheads">Iron Arrowheads</option>
                    <option value ="steelArrowheads">Steel Arrowheads</option>
                    <option value ="palladiumArrowheads">Palladium Arrowheads</option>
                    <option value ="coroniumArrowheads">Coronium Arrowheads</option>
                    <option value ="celadonArrowheads">Celadon Arrowheads</option>
                `;
                break;
            }
        }
    }

    private submitOrder(): void {
        if (!this.orderInputSkill || ! this.orderInputCategory || !this.orderInputItem) return;
        if (this.isLoggedIn == false) {
            if (!this.orderInput) return;
            this.orderInput.innerHTML = `
                <div class="item-loading">
                    <p>Failed...</p>
                    <p class="item-loading-hint">Please log in to submit orders</p>
                </div>
            `;
        }else{
            let username = this.gameHooks.EntityManager.Instance.MainPlayer._name;
            let orderAmount = (document.getElementById('orderAmount') as HTMLSelectElement).value;
            let orderPrice = (document.getElementById('orderPrice') as HTMLSelectElement).value;
            let playerMapPos = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentGamePosition;
            let orderX = playerMapPos.X;
            let orderY = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel;
            let orderZ = playerMapPos.Z;
            this.log('Sending order request!');
            fetch("https://highspellwoodcuttersunion.online/register_order.php/?username=" + username + 
                "&skill=" + this.orderInputSkill.value + "&category=" + this.orderInputCategory.value + "&type=" + this.orderInputItem.value +
                "&amount=" + orderAmount + "&price=" + orderPrice + 
                "&x=" + orderX + "&y=" + orderY + "&z=" + orderZ)
            .then((response) => response.text())
            .then((result) => this.log(result))
            .catch((error) => this.error(error));
        }
    }

    private closeModal(): void {
        if (this.modalOverlay) {
            // Clean up sprites used in modal before removing
            this.modalOverlay.remove();
            this.modalOverlay = null;
        }
    }

    private showLoadingState(): void {
        if (!this.itemListContainer) return;

        this.itemListContainer.innerHTML = `
            <div class="item-loading">
                <p>Loading orders...</p>
                <p class="item-loading-hint">Please log in to view orders</p>
            </div>
        `;
    }

    private updateOrders(): void {
        fetch("https://highspellwoodcuttersunion.online/view_orders.php/")
            .then((response) => response.json())
            .then((result) => this.showOrders(result))
            .catch((error) => this.error(error));
    }

    private showOrders(results): void {
        if (!this.itemListContainer) return;
        this.itemListContainer.innerHTML = "";

        for (let index = 0; index < results.length; index++) {
            if (!this.settings.recieveOrders.value && results[index][1] != this.gameHooks.EntityManager.Instance.MainPlayer._name) continue;
            let itemContainer = document.createElement('div');
            itemContainer.className = 'item-orders-order-container';
            itemContainer.innerHTML =  `
                <span>Requested by: ` + results[index][1] + `</span><br>
                <span>Item: ` + results[index][4] + `</span><br>
                <span>Amount: ` + results[index][6] + `/` + results[index][5] + `</span><br>
                <span>Price per item: ` + results[index][7] + `</span><br>
                <span>Location: X: ` + results[index][8] + ` Z: ` + results[index][10] + `</span><br>
            `;
            if (results[index][1] == this.gameHooks.EntityManager.Instance.MainPlayer._name){
                let usernameInput = document.createElement("input");
                usernameInput.type = "text";
                usernameInput.name = "username";
                usernameInput.className = "item-orders-item-text-input";
                usernameInput.placeholder = "Username";

                let amountInput = document.createElement("input");
                amountInput.type = "text";
                amountInput.name = "amount";
                amountInput.className = "item-orders-item-text-input";
                amountInput.placeholder = "Amount delivered";

                let updateOrderBtn = document.createElement('button');
                updateOrderBtn.textContent = 'Update Order';
                updateOrderBtn.onclick =  () => this.markOrderComplete(results[index][0], usernameInput, amountInput);

                itemContainer.appendChild(usernameInput);
                itemContainer.appendChild(amountInput);
                itemContainer.appendChild(updateOrderBtn);
            }
            this.itemListContainer.appendChild(itemContainer);
        }
    }

    private markOrderComplete(id, usernameInput, amountInput): void {
        fetch("https://highspellwoodcuttersunion.online/complete_order.php/?id=" + id + 
            "&username=" + usernameInput.value + "&amount=" + amountInput.value)
            .then((response) => response.json())
            .then(() => this.updateOrders())
            .catch((error) => this.error(error));
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.setAttribute('data-item-panel', 'true');
        style.textContent = `
            /* Panel Container */
            .item-panel-list-wrapper {
                overflow: scroll;
            }
            .item-orders-panel {
                width: 100% !important;
                height: 100% !important;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            /* Request */
            .item-orders-request-container {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
            }
            
            .item-orders-request-container h3 {
                margin: 0;
                color: #fff;
                font-size: 18px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .item-orders-order-input-container input {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }

            .item-orders-item-text-input {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .item-orders-order-input-container select {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }

            .item-orders-order-input-container button {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }

            .item-orders-order-input-container::placeholder {
                color: #888;
            }
            
            .item-orders-order-input-container:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            .item-orders-list-container{
                flex-grow: 1;
                overflow: auto;
            }

            .item-orders-order-container {
                padding: 12px 15px;
                margin: 5px;
                border: 1px solid #333;
                flex-shrink: 0;
            }

            .item-orders-order-container button {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 10px;
                box-sizing: border-box;
            }
        `;
        this.panelContent?.appendChild(style);
    }
}