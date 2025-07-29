/**
 * menu.tsx - Script for menu.html (Menu Planner)
 */
import {
    currentUser, currentUnitSystem, supabaseClient,
    initializeGlobalFunctionality,
    sanitizeHTML, panSVG,
    updateUnitSystem,
    WeeklyMenu, DayMeal, GroceryListCategory, UserMenuSummary, Recipe
} from "./core";

// DOM Elements specific to this page
let menuPlannerViewContent: HTMLDivElement | null;
let generateWeeklyMenuButton: HTMLButtonElement | null;
let saveCurrentMenuButton: HTMLButtonElement | null;
let savedMenusDropdown: HTMLSelectElement | null;
let weeklyMenuDisplay: HTMLDivElement | null;
let groceryListDisplay: HTMLDivElement | null;
let menuPlannerMessages: HTMLDivElement | null;
let menuPlannerControls: HTMLDivElement | null; // For has-saved-menus class

// Page specific state
let isMenuPlannerLoadingState = false;
let currentWeeklyMenuDataState: WeeklyMenu | null = null;
let currentGroceryListDataState: { groceryList: GroceryListCategory[] } | null = null;
let isMenuUnitUpdating: boolean = false;

// Define system instruction locally for this page
const SOUSIE_MENU_SYSTEM_INSTRUCTION = "You are Sousie, an expert meal planner. Create balanced, appealing, and diverse weekly dinner menus. Ensure all recipes are complete with clear ingredients and instructions. For grocery lists, organize items by common supermarket categories (e.g., Produce, Dairy & Eggs, Meat & Seafood, Pantry Staples, Frozen).";


function initializeMenuPageDOMReferences() {
    menuPlannerViewContent = document.getElementById('menu-planner-view-content') as HTMLDivElement;
    generateWeeklyMenuButton = document.getElementById('generate-weekly-menu-button') as HTMLButtonElement;
    saveCurrentMenuButton = document.getElementById('save-current-menu-button') as HTMLButtonElement;
    savedMenusDropdown = document.getElementById('saved-menus-dropdown') as HTMLSelectElement;
    weeklyMenuDisplay = document.getElementById('weekly-menu-display') as HTMLDivElement;
    groceryListDisplay = document.getElementById('grocery-list-display') as HTMLDivElement;
    menuPlannerMessages = document.getElementById('menu-planner-messages') as HTMLDivElement;
    menuPlannerControls = document.getElementById('menu-planner-controls') as HTMLDivElement;
}

function setMenuPlannerPageLoading(isLoading: boolean, message?: string) {
    isMenuPlannerLoadingState = isLoading;
    if (generateWeeklyMenuButton) generateWeeklyMenuButton.disabled = isLoading;
    if (saveCurrentMenuButton) saveCurrentMenuButton.disabled = isLoading || !currentUser || !currentWeeklyMenuDataState;
    if (savedMenusDropdown) savedMenusDropdown.disabled = isLoading || !currentUser;

    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if (coreUsUnitsButton) coreUsUnitsButton.disabled = isLoading || isMenuUnitUpdating;
    if (coreMetricUnitsButton) coreMetricUnitsButton.disabled = isLoading || isMenuUnitUpdating;


    if (menuPlannerMessages) {
        if (isLoading) {
            menuPlannerMessages.innerHTML = `<div class="message loading-message">${panSVG} ${sanitizeHTML(message || 'Sousie is planning your week...')}</div>`;
            menuPlannerMessages.style.display = 'block';
        } else {
            const loadingMsgEl = menuPlannerMessages.querySelector('.loading-message');
            if (loadingMsgEl) {
                menuPlannerMessages.innerHTML = '';
                menuPlannerMessages.style.display = 'none';
            }
        }
    }
}

function displayMenuPageMessage(message: string, type: 'info' | 'error' | 'warning' = 'info') {
    if (!menuPlannerMessages) return;
    menuPlannerMessages.innerHTML = `<div class="message ${type}-message">${panSVG} ${sanitizeHTML(message)}</div>`;
    menuPlannerMessages.style.display = 'block';
    if (type !== 'loading-message' && weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = ''; // Clear content unless it's a loading message overlaying existing content
    if (type !== 'loading-message' && groceryListDisplay) groceryListDisplay.innerHTML = '';
}

// Local function to create a display card for a day's meal
function createDayCard(dayMeal: DayMeal, index: number): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'day-card';
    card.setAttribute('aria-labelledby', `day-title-${index}`);
    card.setAttribute('role', 'article');

    let innerHTML = `<div class="day-card-header">
                       <h3 id="day-title-${index}" class="day-card-title">${sanitizeHTML(dayMeal.dayName)} - ${sanitizeHTML(dayMeal.mealName)}</h3>
                     </div>`;

    if (dayMeal.recipe) {
        const recipe = dayMeal.recipe;
        innerHTML += `<div class="recipe-summary-menu">`;
        innerHTML += `<h4 class="recipe-name-menu">${sanitizeHTML(recipe.name)}</h4>`;

        if (recipe.description) {
            innerHTML += `<p class="recipe-description-menu">${sanitizeHTML(recipe.description)}</p>`;
        }
        if (recipe.anecdote) {
            innerHTML += `<p class="recipe-anecdote-menu"><em>"${sanitizeHTML(recipe.anecdote)}"</em></p>`;
        }
        if (recipe.chefTip) {
            innerHTML += `<p class="recipe-cheftip-menu"><strong>Chef's Tip:</strong> ${sanitizeHTML(recipe.chefTip)}</p>`;
        }

        if (recipe.ingredients && recipe.ingredients.length > 0) {
            innerHTML += `<h5 class="menu-section-title">Ingredients (${currentUnitSystem === 'us' ? 'US Customary' : 'Metric'}):</h5><ul class="menu-ingredient-list">`;
            recipe.ingredients.forEach(ing => {
                innerHTML += `<li>${sanitizeHTML(ing)}</li>`;
            });
            innerHTML += `</ul>`;
        } else {
            innerHTML += `<h5 class="menu-section-title">Ingredients:</h5><p>Not specified.</p>`;
        }

        if (recipe.instructions && recipe.instructions.length > 0) {
            innerHTML += `<h5 class="menu-section-title">Instructions:</h5><ol class="menu-instruction-list">`;
            recipe.instructions.forEach(instr => {
                innerHTML += `<li>${sanitizeHTML(instr)}</li>`;
            });
            innerHTML += `</ol>`;
        } else {
             innerHTML += `<h5 class="menu-section-title">Instructions:</h5><p>Not specified.</p>`;
        }
        innerHTML += `</div>`; // close recipe-summary-menu
    } else {
        innerHTML += `<p>No recipe details available for this meal.</p>`;
    }
    card.innerHTML = innerHTML;
    return card;
}


function displayWeeklyMenuOnPage(menuData: WeeklyMenu) {
    if (!weeklyMenuDisplay || !menuData || !Array.isArray(menuData.weeklyMenu) || menuData.weeklyMenu.length === 0) {
        displayMenuPageMessage("Sousie couldn't generate a weekly menu. Please try again!", "error");
        return;
    }
    weeklyMenuDisplay.innerHTML = '<h2>Your 7-Day Dinner Menu</h2>';
    const grid = document.createElement('div');
    grid.className = 'weekly-menu-grid';
    menuData.weeklyMenu.forEach((dayMeal, index) => {
        if (dayMeal && dayMeal.recipe) {
            grid.appendChild(createDayCard(dayMeal, index));
        }
    });
    weeklyMenuDisplay.appendChild(grid);
    if (menuPlannerMessages && menuPlannerMessages.querySelector('.loading-message')) {
        menuPlannerMessages.innerHTML = '';
        menuPlannerMessages.style.display = 'none';
    }
    if (saveCurrentMenuButton) saveCurrentMenuButton.disabled = !currentUser;
}

function displayGroceryListOnPage(groceryData: { groceryList: GroceryListCategory[] }) {
    if (!groceryListDisplay || !groceryData || !Array.isArray(groceryData.groceryList) || groceryData.groceryList.length === 0) {
        if(groceryListDisplay) groceryListDisplay.innerHTML = '<p>Could not generate a grocery list for this menu.</p>';
        return;
    }
    groceryListDisplay.innerHTML = '<h2>Your Weekly Grocery List</h2>';
    groceryData.groceryList.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'grocery-category';
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = sanitizeHTML(category.category);
        categoryDiv.appendChild(categoryTitle);
        const ul = document.createElement('ul');
        if (Array.isArray(category.items) && category.items.length > 0) {
            category.items.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<label><input type="checkbox" class="grocery-item-checkbox"> ${sanitizeHTML(item)}</label>`;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = '<li>No items in this category.</li>';
        }
        categoryDiv.appendChild(ul);
        groceryListDisplay.appendChild(categoryDiv);
    });
}

async function handleGenerateGroceryListForPage() {
    if (!ai || !API_KEY || !currentWeeklyMenuDataState) {
        displayMenuPageMessage("Cannot generate grocery list without a menu or AI.", "error");
        return;
    }
    setMenuPlannerPageLoading(true, "Creating your grocery list...");
    const unitSystemInstructions = `Quantities in ${currentUnitSystem === 'us' ? 'US Customary' : 'Metric'}.`;
    const prompt = `Menu JSON: ${JSON.stringify(currentWeeklyMenuDataState)}. Aggregate ingredients into categorized grocery list. ${unitSystemInstructions} Respond ONLY with JSON: {"groceryList": [{"category": "Produce", "items": ["3 onions"]}, ...]}. PURE JSON, no extra text.`;
    let jsonStrToParse = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", systemInstruction: SOUSIE_MENU_SYSTEM_INSTRUCTION, thinkingConfig: { thinkingBudget: 0 } },
        });
        let rawText = (typeof response.text === 'string') ? response.text.trim() : "";
        const match = rawText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawText;
        if (!jsonStrToParse) throw new Error("Empty AI response for grocery list.");
        currentGroceryListDataState = JSON.parse(jsonStrToParse);
        displayGroceryListOnPage(currentGroceryListDataState);
    } catch (error) {
        console.error("Error generating grocery list:", error, "\nMalformed JSON:", jsonStrToParse);
        displayMenuPageMessage("Sousie had trouble making the grocery list. Try regenerating menu.", "error");
        if(groceryListDisplay) groceryListDisplay.innerHTML = '<p>Error creating grocery list.</p>';
    } finally {
        setMenuPlannerPageLoading(false);
    }
}

async function handleGenerateWeeklyMenuForPage() {
    if (!ai || !API_KEY) return;
    setMenuPlannerPageLoading(true, "Dreaming up a delicious week for you...");
    if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
    if(groceryListDisplay) groceryListDisplay.innerHTML = '';

    // For MPA, dietary input is not on this page. Can be added or fetched from profile later.
    const dietaryRestrictions = 'None'; // Simplified for now
    const unitSystemInstructions = `All ingredient quantities in recipes MUST be in ${currentUnitSystem === 'us' ? 'US Customary' : 'Metric'} units.`;
    const recipeObjectJsonFormat = `"name": "Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 item"], "instructions": ["1 step"]`;
    const prompt = `Generate a 7-day dinner menu. Each day ("Monday" to "Sunday") needs "dayName", "mealName", and "recipe" object ({${recipeObjectJsonFormat}}). Dietary: "${dietaryRestrictions}". ${unitSystemInstructions} JSON ONLY: {"weeklyMenu": [{"dayName": "Monday", ...}, ...]}. All fields mandatory, arrays non-empty.`;
    let jsonStrToParse = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", systemInstruction: SOUSIE_MENU_SYSTEM_INSTRUCTION, thinkingConfig: { thinkingBudget: 0 } },
        });
        let rawText = (typeof response.text === 'string') ? response.text.trim() : "";
        const match = rawText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawText;
        if (!jsonStrToParse) throw new Error("Empty AI response for weekly menu.");
        currentWeeklyMenuDataState = JSON.parse(jsonStrToParse);
        if (currentWeeklyMenuDataState?.weeklyMenu?.length > 0) {
            displayWeeklyMenuOnPage(currentWeeklyMenuDataState);
            await handleGenerateGroceryListForPage();
        } else {
            throw new Error("Parsed menu data is empty or invalid.");
        }
    } catch (error) {
        console.error("Error generating weekly menu:", error, "\nMalformed JSON:", jsonStrToParse);
        displayMenuPageMessage("Sousie couldn't cook up a weekly menu. Please try again.", "error");
        currentWeeklyMenuDataState = null;
    } finally {
        setMenuPlannerPageLoading(false);
    }
}

async function populateSavedMenusDropdownForPage() {
    if (!supabaseClient || !currentUser || !savedMenusDropdown) return;
    savedMenusDropdown.innerHTML = '<option value="">Load a saved menu...</option>';
    try {
        const { data, error } = await supabaseClient
            .from('user_menus').select('id, menu_name').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (error) {
             if (error.message.includes("Failed to fetch")) throw new Error("Network error: Could not load saved menus.");
             throw error;
        }
        const currentSavedUserMenus: UserMenuSummary[] = data || [];
        if (currentSavedUserMenus.length > 0) {
            currentSavedUserMenus.forEach(menu => {
                const option = document.createElement('option');
                option.value = menu.id;
                option.textContent = sanitizeHTML(menu.menu_name);
                savedMenusDropdown.appendChild(option);
            });
            savedMenusDropdown.style.display = 'inline-block';
            if(menuPlannerControls) menuPlannerControls.classList.add('has-saved-menus');
        } else {
            savedMenusDropdown.style.display = 'none';
            if(menuPlannerControls) menuPlannerControls.classList.remove('has-saved-menus');
        }
    } catch (error: any) {
        console.error("Error fetching saved menus:", error.message);
        displayMenuPageMessage(error.message, "error");
        if(savedMenusDropdown) savedMenusDropdown.style.display = 'none';
        if(menuPlannerControls) menuPlannerControls.classList.remove('has-saved-menus');
    }
}

async function handleSaveCurrentMenuForPage() {
    if (!supabaseClient || !currentUser || !currentWeeklyMenuDataState) {
        alert("Log in and generate a menu to save it."); return;
    }
    const menuName = prompt("Enter a name for this menu:");
    if (!menuName?.trim()) { alert("Menu name cannot be empty."); return; }
    setMenuPlannerPageLoading(true, "Saving your menu...");
    try {
        const { error } = await supabaseClient.from('user_menus').insert({
            user_id: currentUser.id, menu_name: menuName.trim(), menu_data: currentWeeklyMenuDataState
        });
        if (error) throw error;
        alert("Menu saved successfully!");
        await populateSavedMenusDropdownForPage();
    } catch (error: any) {
        console.error("Error saving menu:", error.message);
        alert(`Failed to save menu: ${error.message}`);
    } finally {
        setMenuPlannerPageLoading(false);
    }
}

async function handleLoadSavedMenuForPage() {
    if (!supabaseClient || !currentUser || !savedMenusDropdown || !savedMenusDropdown.value) return;
    const menuId = savedMenusDropdown.value;
    setMenuPlannerPageLoading(true, "Loading your saved menu...");
    if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
    if(groceryListDisplay) groceryListDisplay.innerHTML = '';
    try {
        const { data, error } = await supabaseClient
            .from('user_menus').select('menu_data').eq('id', menuId).eq('user_id', currentUser.id).single();
        if (error) throw error;
        if (data?.menu_data) {
            currentWeeklyMenuDataState = data.menu_data as WeeklyMenu;
            if (currentWeeklyMenuDataState?.weeklyMenu) {
                 displayWeeklyMenuOnPage(currentWeeklyMenuDataState);
                 await handleGenerateGroceryListForPage();
            } else {
                throw new Error("Loaded menu data is not in expected format.");
            }
        } else {
            throw new Error("No data found for selected menu.");
        }
    } catch (error: any) {
        console.error("Error loading saved menu:", error.message);
        displayMenuPageMessage(`Failed to load menu: ${error.message}`, "error");
        currentWeeklyMenuDataState = null;
    } finally {
        setMenuPlannerPageLoading(false);
    }
}

async function handleMenuPageUnitChange(newSystem: 'us' | 'metric') {
    if (isMenuPlannerLoadingState || currentUnitSystem === newSystem) return;
    // const oldSystem = currentUnitSystem; // Keep old system in case of error if needed.
    updateUnitSystem(newSystem);

    if (currentWeeklyMenuDataState && menuPlannerViewContent) {
        isMenuUnitUpdating = true;
        const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
        const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
        if(coreUsUnitsButton) coreUsUnitsButton.disabled = true;
        if(coreMetricUnitsButton) coreMetricUnitsButton.disabled = true;

        menuPlannerViewContent.classList.add('content-stale-for-unit-update');
        setMenuPlannerPageLoading(true, "Updating units for your menu...");

        // Re-render menu with new units. createDayCard uses currentUnitSystem.
        displayWeeklyMenuOnPage(currentWeeklyMenuDataState);

        // Re-generate grocery list if it exists, as quantities might need to change
        if (currentGroceryListDataState && currentWeeklyMenuDataState) { // Ensure menu data is still valid
            await handleGenerateGroceryListForPage();
        }
        // Brief pause for visual feedback (optional)
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay

        isMenuUnitUpdating = false;
        menuPlannerViewContent.classList.remove('content-stale-for-unit-update');
        setMenuPlannerPageLoading(false); // This will re-enable unit buttons based on global state
        if(coreUsUnitsButton) coreUsUnitsButton.disabled = isMenuPlannerLoadingState;
        if(coreMetricUnitsButton) coreMetricUnitsButton.disabled = isMenuPlannerLoadingState;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalFunctionality();
    initializeMenuPageDOMReferences();

    if (!API_KEY) {
        displayMenuPageMessage("AI features are unavailable (API_KEY missing). Menu generation is disabled.", "error");
        if(generateWeeklyMenuButton) generateWeeklyMenuButton.disabled = true;
    } else if (!currentUser && supabaseClient) { // Supabase ready but no user
        displayMenuPageMessage("Please log in to save and load your weekly menus.", "info");
         if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
         if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
    } else if (currentUser && supabaseClient) { // User logged in and Supabase ready
        populateSavedMenusDropdownForPage();
        if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'inline-block';
        // savedMenusDropdown display is handled by populateSavedMenusDropdownForPage
        // Initial message if no menu loaded yet for a logged-in user
        if (!currentWeeklyMenuDataState && menuPlannerMessages && !isMenuPlannerLoadingState) {
             displayMenuPageMessage(`Let's plan your week! Click "Generate Weekly Menu" to start or load a saved menu.`, "info");
        }
    } else { // No API key and/or no Supabase client
         displayMenuPageMessage("Menu planner features are currently limited. Please ensure API and Database are configured.", "warning");
         if(generateWeeklyMenuButton) generateWeeklyMenuButton.disabled = true;
         if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
         if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
    }


    if (generateWeeklyMenuButton) generateWeeklyMenuButton.addEventListener('click', handleGenerateWeeklyMenuForPage);
    if (saveCurrentMenuButton) saveCurrentMenuButton.addEventListener('click', handleSaveCurrentMenuForPage);
    if (savedMenusDropdown) savedMenusDropdown.addEventListener('change', handleLoadSavedMenuForPage);

    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if(coreUsUnitsButton) coreUsUnitsButton.addEventListener('click', () => handleMenuPageUnitChange('us'));
    if(coreMetricUnitsButton) coreMetricUnitsButton.addEventListener('click', () => handleMenuPageUnitChange('metric'));

    // Listener for auth changes to update menu page UI
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((_event: string, session: any) => {
            // currentUser is updated by core's onAuthStateChange which is called by initializeGlobalFunctionality
            const user = session?.user ?? null;
            if (user) { // User logged in
                populateSavedMenusDropdownForPage(); // This will also handle display of dropdown
                if (saveCurrentMenuButton) {
                    saveCurrentMenuButton.style.display = 'inline-block';
                    saveCurrentMenuButton.disabled = !currentWeeklyMenuDataState; // Only enable if there's a menu
                }
                // If previously there was an info message about logging in, and no menu, show the welcome message
                if (!currentWeeklyMenuDataState && menuPlannerMessages && !isMenuPlannerLoadingState) {
                    displayMenuPageMessage(`Let's plan your week! Click "Generate Weekly Menu" to start or load a saved menu.`, "info");
                }

            } else { // Logged out
                currentWeeklyMenuDataState = null; // Clear user-specific data
                currentGroceryListDataState = null;
                if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
                if(groceryListDisplay) groceryListDisplay.innerHTML = '';
                if (saveCurrentMenuButton) {
                    saveCurrentMenuButton.style.display = 'none';
                    saveCurrentMenuButton.disabled = true;
                }
                if (savedMenusDropdown) {
                    savedMenusDropdown.innerHTML = '<option value="">Login to see saved menus</option>';
                    savedMenusDropdown.style.display = 'none'; // Hide dropdown
                }
                 if (menuPlannerControls) menuPlannerControls.classList.remove('has-saved-menus');
                 if (!API_KEY) { // If AI is also disabled
                    displayMenuPageMessage("AI features are unavailable. Menu generation is disabled.", "error");
                 } else {
                    displayMenuPageMessage("Please log in to save and load your weekly menus.", "info");
                 }
            }
        });
    }
});
