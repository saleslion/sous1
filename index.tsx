/**
 * index.tsx - Main script for Sousie Single Page Application
 */
import {
    currentUser, currentUnitSystem,
    initializeGlobalFunctionality,
    sanitizeHTML, generateDynamicLoadingMessage,
    createExpandableRecipeCard, updateUnitSystem, panSVG,
    trackUserIntent
} from "./core";

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// DOM Elements
let resultsContainer: HTMLDivElement | null;
let ingredientsInput: HTMLInputElement | null;
let dietaryInput: HTMLInputElement | null;
let suggestButton: HTMLButtonElement | null;
let surpriseButton: HTMLButtonElement | null;
let startOverButton: HTMLButtonElement | null;

// Chat Elements
let chatMessages: HTMLDivElement | null;
let chatInput: HTMLInputElement | null;
let chatSendButton: HTMLButtonElement | null;
let clearChatButton: HTMLButtonElement | null;

// Navigation Elements
let navItems: NodeListOf<HTMLButtonElement> | null;
let viewContents: NodeListOf<HTMLDivElement> | null;

// Page specific state
let isLoadingRecipes = false;
let lastUserIngredients: string | null = null;
let lastUserDietary: string | null = null;
let lastFetchWasSurprise: boolean = false;
let isUnitUpdatingRecipes: boolean = false;
let lastSuccessfulFetchSeed: number | null = null;

// Chat conversation context
let conversationHistory: Array<{role: string, content: string}> = [];

// Sousie system instruction
const SOUSIE_SYSTEM_INSTRUCTION = `You are Sousie, a friendly and creative AI cooking assistant with a warm, conversational personality. You're like a knowledgeable friend who loves to cook and share culinary wisdom.

Key traits:
- Be conversational and engaging, like you're chatting with a friend in the kitchen
- Ask follow-up questions to better understand what the user needs
- Share cooking tips, tricks, and personal anecdotes about recipes
- Be encouraging and enthusiastic about cooking adventures
- Remember the conversation context and refer back to previous messages
- Use emojis occasionally to add warmth (🍳👨‍🍳🥄✨)
- Be specific with recipes and techniques, but explain things in an approachable way
- Suggest variations and substitutions based on preferences or dietary needs
- Share the "why" behind cooking techniques, not just the "how"

Topics you excel at:
- Recipe suggestions and modifications
- Cooking techniques and troubleshooting
- Ingredient substitutions and alternatives
- Meal planning and prep strategies
- Kitchen equipment recommendations
- Food safety and storage tips
- Dietary accommodations (vegan, gluten-free, etc.)
- Flavor pairing and seasoning advice
- Cooking for different occasions and group sizes

Always be helpful, encouraging, and ready to dive deeper into any cooking topic!`;

// Separate system instruction for recipe generation (structured JSON responses)
const RECIPE_GENERATION_INSTRUCTION = "You are a JSON recipe generator. You MUST respond ONLY with valid JSON format. Do NOT include any explanatory text, greetings, or conversational language. Do NOT use markdown code blocks. Provide only the raw JSON object with detailed recipe data including specific measurements and clear step-by-step instructions.";


function initializeDOMReferences() {
    resultsContainer = document.getElementById('results-container') as HTMLDivElement;
    ingredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
    dietaryInput = document.getElementById('dietary-input') as HTMLInputElement;
    suggestButton = document.getElementById('suggest-button') as HTMLButtonElement;
    surpriseButton = document.getElementById('surprise-button') as HTMLButtonElement;
    startOverButton = document.getElementById('start-over-button') as HTMLButtonElement;
    
    // Chat elements
    chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
    chatInput = document.getElementById('chat-input') as HTMLInputElement;
    chatSendButton = document.getElementById('chat-send-button') as HTMLButtonElement;
    clearChatButton = document.getElementById('clear-chat-button') as HTMLButtonElement;
    
    // Navigation elements
    navItems = document.querySelectorAll('.nav-item');
    viewContents = document.querySelectorAll('.view');
}

// Loading message rotation
let loadingMessageInterval: number | null = null;
let currentMessageIndex = 0;

const cookingMessages = [
    "Sousie is cooking recipes for you...",
    "Still cooking, almost ready...",
    "The fires are hot, recipes brewing...",
    "Mixing ingredients with love...",
    "Adding the perfect spices...",
    "Tasting and perfecting flavors...",
    "Almost done, plating the dishes...",
    "Final touches being added...",
    "Creating culinary magic...",
    "Stirring up something delicious..."
];

function startLoadingMessageRotation(initialMessage?: string) {
    const loadingMessage = document.getElementById('loading-message');
    if (!loadingMessage) return;
    
    // Set initial message
    if (initialMessage) {
        loadingMessage.textContent = initialMessage;
    } else {
        loadingMessage.textContent = cookingMessages[0];
    }
    
    currentMessageIndex = 0;
    
    // Rotate messages every 2 seconds
    loadingMessageInterval = setInterval(() => {
        currentMessageIndex = (currentMessageIndex + 1) % cookingMessages.length;
        if (loadingMessage) {
            loadingMessage.style.opacity = '0.5';
            setTimeout(() => {
                if (loadingMessage) {
                    loadingMessage.textContent = cookingMessages[currentMessageIndex];
                    loadingMessage.style.opacity = '1';
                }
            }, 200);
        }
    }, 2000);
}

function stopLoadingMessageRotation() {
    if (loadingMessageInterval) {
        clearInterval(loadingMessageInterval);
        loadingMessageInterval = null;
    }
}

function setRecipeSuggestionsLoading(loading: boolean, ingredientsForLoadingMessage?: string) {
    console.log('🔧 DEBUG: setRecipeSuggestionsLoading called:', { loading, ingredientsForLoadingMessage });
    isLoadingRecipes = loading;
    
    // Show/hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (loadingOverlay) {
        if (loading) {
            // Determine initial message
            let initialMessage = "Sousie is cooking recipes for you...";
            if (ingredientsForLoadingMessage === "a delightful surprise") {
                initialMessage = "Conjuring surprise recipes just for you...";
            } else if (ingredientsForLoadingMessage) {
                initialMessage = `Creating recipes with ${ingredientsForLoadingMessage}...`;
            }
            
            // Show overlay and start message rotation
            loadingOverlay.style.display = 'flex';
            startLoadingMessageRotation(initialMessage);
        } else {
            // Hide overlay and stop message rotation
            loadingOverlay.style.display = 'none';
            stopLoadingMessageRotation();
        }
    }
    if (ingredientsInput) ingredientsInput.disabled = loading;
    if (dietaryInput) dietaryInput.disabled = loading;
    if (suggestButton) suggestButton.disabled = loading;
    if (surpriseButton) surpriseButton.disabled = loading;
    if (startOverButton) startOverButton.disabled = loading;

    // Disable common header buttons during loading
    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    const coreMenuPlannerLink = document.getElementById('menu-planner-link') as HTMLAnchorElement | null;
    const coreFavoritesLink = document.getElementById('favorites-link') as HTMLAnchorElement | null;

    if (coreUsUnitsButton) coreUsUnitsButton.disabled = loading || isUnitUpdatingRecipes;
    if (coreMetricUnitsButton) coreMetricUnitsButton.disabled = loading || isUnitUpdatingRecipes;
    if (coreMenuPlannerLink) { coreMenuPlannerLink.style.pointerEvents = loading ? 'none' : ''; coreMenuPlannerLink.style.opacity = loading ? '0.6' : '1';}
    if (coreFavoritesLink) { coreFavoritesLink.style.pointerEvents = loading ? 'none' : ''; coreFavoritesLink.style.opacity = loading ? '0.6' : '1';}


    const busyAttr = 'aria-busy';
    if (loading) {
        suggestButton?.setAttribute(busyAttr, 'true');
        surpriseButton?.setAttribute(busyAttr, 'true');
        if (resultsContainer && !isUnitUpdatingRecipes) { // Don't overwrite if just units are changing
            const messageParts = generateDynamicLoadingMessage(ingredientsForLoadingMessage);
            resultsContainer.innerHTML = `<div class="message loading-message">${messageParts.svgIcon} ${sanitizeHTML(messageParts.opener)} ${sanitizeHTML(messageParts.mainMessage)} ${sanitizeHTML(messageParts.action)}</div>`;
        }
    } else {
        suggestButton?.removeAttribute(busyAttr);
        surpriseButton?.removeAttribute(busyAttr);
    }
}

function displayRecipeError(message: string) {
    console.log('🔧 DEBUG: displayRecipeError called with message:', message);
    console.log('🔧 DEBUG: resultsContainer:', resultsContainer);
    
    if (resultsContainer) {
        console.log('🔧 DEBUG: Displaying error in results container');
        resultsContainer.innerHTML = '';
        const errorElement = document.createElement('div');
        errorElement.className = 'message error-message';
        errorElement.textContent = message; // sanitizeHTML(message) if message could be unsafe
        resultsContainer.appendChild(errorElement);
        console.log('🔧 DEBUG: Error element added to DOM');
    } else {
        console.error('🔧 DEBUG: No results container found!');
    }
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
}


function displayResults(data: any, type: 'recipes' | 'surprise') {
    console.log('🔧 DEBUG: displayResults called with type:', type, 'data:', data);
    if (!resultsContainer) {
        console.error('🔧 DEBUG: No results container found!');
        return;
    }
    console.log('🔧 DEBUG: Clearing results container and displaying new results');
    resultsContainer.innerHTML = '';

    // Minimize the recipe finder form when showing results
    const recipeFinderForm = document.getElementById('recipe-finder-form');
    
    if (data.mealPairings && Array.isArray(data.mealPairings) && data.mealPairings.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'recipes-grid';
        
        // Add a header for the results
        const resultsHeader = document.createElement('div');
        resultsHeader.style.cssText = 'margin-bottom: 24px; text-align: center;';
        resultsHeader.innerHTML = `
            <h3 style="font-size: 24px; font-weight: 600; color: var(--text); margin-bottom: 8px;">
                ${type === 'surprise' ? '🎲 Surprise Recipes' : '🍳 Recipe Suggestions'}
            </h3>
            <p style="color: var(--text-muted); font-size: 16px;">
                ${data.mealPairings.length} delicious ${data.mealPairings.length === 1 ? 'recipe' : 'recipes'} ready for you!
            </p>
        `;
        resultsContainer.appendChild(resultsHeader);
        
        data.mealPairings.forEach((mealPairing: any, index: number) => {
            if (mealPairing && mealPairing.mainRecipe) {
                grid.appendChild(createExpandableRecipeCard(mealPairing, `${type}-${index}`, false));
            } else {
                console.warn("Skipping malformed mealPairing:", mealPairing);
            }
        });
        if (grid.children.length > 0) {
            resultsContainer.appendChild(grid);
        } else {
            resultsContainer.innerHTML = `<div class="message info-message">${panSVG} Sousie found some ideas, but they weren't quite ready. Try again!</div>`;
        }
        
        // Minimize the form
        if (recipeFinderForm) {
            recipeFinderForm.style.cssText = 'padding: 24px; text-align: center; background: var(--background); border-radius: 8px; margin-top: 32px;';
            recipeFinderForm.innerHTML = `
                <h4 style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 16px;">Want more recipes?</h4>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button id="suggest-button" class="btn btn-primary">Find More Recipes</button>
                    <button id="surprise-button" class="btn btn-outline">Surprise Me Again</button>
                    <button id="start-over-button" class="btn btn-outline">Start Over</button>
                </div>
            `;
            // Re-initialize buttons after changing innerHTML
            setTimeout(() => {
                initializeRecipeFinderButtons();
            }, 100);
        }
    } else {
        resultsContainer.innerHTML = `<div class="message info-message">${panSVG} Sousie pondered, but couldn't find specific meal pairings for that. Try different ingredients or ask for a surprise!</div>`;
    }
    
    // Scroll to the top of the view to show results
    const recipesView = document.getElementById('recipes-view');
    if (recipesView) {
        recipesView.scrollTop = 0;
    }
}

// OpenAI API call function
async function callOpenAI(messages: any[], temperature: number = 0.7): Promise<string> {
    console.log('🔧 DEBUG: callOpenAI started');
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }
    
    console.log('🔧 DEBUG: Making fetch request to OpenAI...');
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: temperature,
            max_tokens: 2000
        })
    });
    
    console.log('🔧 DEBUG: Got response from OpenAI, status:', response.status);
    if (!response.ok) {
        console.error('🔧 DEBUG: OpenAI API error:', response.statusText);
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    console.log('🔧 DEBUG: Parsing JSON response...');
    const data = await response.json();
    console.log('🔧 DEBUG: OpenAI response data:', data);
    return data.choices[0].message.content;
}

async function handleSuggestRecipes(ingredientsQuery?: string) {
    console.log("🔧 DEBUG: ===== HANDLE SUGGEST RECIPES CALLED =====");
    console.log("🔧 DEBUG: Function parameters:", {
        ingredientsQuery,
        OPENAI_API_KEY: !!OPENAI_API_KEY,
        isLoadingRecipes,
        ingredientsInput: !!ingredientsInput,
        dietaryInput: !!dietaryInput
    });
    
    if (!OPENAI_API_KEY || isLoadingRecipes || !ingredientsInput || !dietaryInput) {
        console.error("🔧 DEBUG: Early return - missing dependencies");
        return;
    }
    const ingredients = ingredientsQuery || ingredientsInput.value.trim();
    const dietaryRestrictions = dietaryInput.value.trim();
    
    console.log('🔧 DEBUG: Input values:', {
        ingredients,
        dietaryRestrictions,
        ingredientsInputValue: ingredientsInput.value,
        dietaryInputValue: dietaryInput.value
    });

    if (!ingredients) {
        console.log('🔧 DEBUG: No ingredients provided, showing error');
        displayRecipeError("Sousie needs some ingredients to work her magic! Please enter some.");
        return;
    }
    
    console.log('🔧 DEBUG: Ingredients check passed, continuing...');
    
    // Track recipe search intent
    const searchData = {
        ingredients: ingredients.split(',').map(i => i.trim()),
        dietary_restrictions: dietaryRestrictions || null,
        search_type: 'ingredient_based',
        timestamp: new Date().toISOString()
    };

    setRecipeSuggestionsLoading(true, ingredients);
    if (!isUnitUpdatingRecipes) {
        lastUserIngredients = ingredients;
        lastUserDietary = dietaryRestrictions;
        lastFetchWasSurprise = false;
    }

    let seedForCurrentApiCall = isUnitUpdatingRecipes && lastSuccessfulFetchSeed !== null
        ? lastSuccessfulFetchSeed
        : Math.floor(Math.random() * 1000000);

    const ingredientList = ingredients.split(',').map(i => i.trim()).filter(i => i);
    if (ingredientList.length === 0) {
        displayRecipeError("Please tell Sousie what ingredients you have!");
        setRecipeSuggestionsLoading(false);
        return;
    }

    const unitInstructions = currentUnitSystem === 'us'
        ? "US Customary units (e.g., cups, oz, lbs, tsp, tbsp)"
        : "Metric units (e.g., ml, grams, kg, L)";
    const recipeObjectJsonFormat = `"name": "Recipe Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 cup flour"], "instructions": ["Preheat." ]`;
    let dietaryClause = dietaryRestrictions ? `Strictly adhere to dietary restrictions: "${dietaryRestrictions}".` : "";

    const promptUserMessage = `I have: "${ingredientList.join(' and ')}". Suggest 4 distinct "mealPairings". Each MUST include: "mainRecipe" object and "sideRecipe" object (could be traditional side or dessert). Use ${unitInstructions}. ${dietaryClause} Both "mainRecipe" and "sideRecipe" objects MUST contain: ${recipeObjectJsonFormat}. All fields are mandatory and non-empty. 'ingredients' and 'instructions' arrays MUST NOT be empty. Each "mealTitle" must be a creative, descriptive name for the meal pairing (e.g., "Classic Comfort Dinner", "Mediterranean Feast", "Spicy Asian Night"). Final JSON structure: {"mealPairings": [{"mealTitle": "Creative Meal Name Here", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. RESPOND ONLY WITH VALID JSON. NO OTHER TEXT.`;

    try {
        const messages = [
            { role: 'system', content: RECIPE_GENERATION_INSTRUCTION },
            { role: 'user', content: promptUserMessage }
        ];
        
        const response = await callOpenAI(messages, 0.3); // Lower temperature for consistent JSON
        console.log("🔧 DEBUG: OpenAI raw response:", response);
        let jsonStrToParse = response.trim();
        
        // Clean up response if it's wrapped in code blocks
        const match = jsonStrToParse.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
        if (match && match[1]) {
            jsonStrToParse = match[1].trim();
        }
        
        if (!jsonStrToParse) throw new Error("Empty AI response for recipe suggestions.");
        console.log("🔧 DEBUG: JSON to parse:", jsonStrToParse);
        const data = JSON.parse(jsonStrToParse);
        console.log("🔧 DEBUG: Parsed data:", data);
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall;
        displayResults(data, 'recipes');
        
        // Track successful recipe search
        await trackUserIntent({
            intent_type: 'recipe_search',
            intent_data: {
                ...searchData,
                results_count: data.mealPairings?.length || 0,
                unit_system: currentUnitSystem
            },
            user_input: `Ingredients: ${ingredients}${dietaryRestrictions ? `, Dietary: ${dietaryRestrictions}` : ''}`,
            success: true
        });
    } catch (error: any) {
        console.error("Error suggesting recipes:", error);
        displayRecipeError("Oh no! Sousie had trouble fetching recipes. Check ingredients or try again.");
        
        // Track failed recipe search
        await trackUserIntent({
            intent_type: 'recipe_search',
            intent_data: {
                ...searchData,
                error_type: error.name || 'Unknown'
            },
            user_input: `Ingredients: ${ingredients}${dietaryRestrictions ? `, Dietary: ${dietaryRestrictions}` : ''}`,
            success: false,
            error_message: error.message
        });
    } finally {
        setRecipeSuggestionsLoading(false);
    }
}

async function handleSurpriseMe() {
    console.log("🔧 DEBUG: ===== HANDLE SURPRISE ME CALLED =====");
    console.log("🔧 DEBUG: Surprise Me parameters:", {
        OPENAI_API_KEY: !!OPENAI_API_KEY,
        isLoadingRecipes,
        dietaryInput: !!dietaryInput
    });
    
    if (!OPENAI_API_KEY || isLoadingRecipes || !dietaryInput) {
        console.error("🔧 DEBUG: Surprise Me early return - missing dependencies");
        return;
    }
    const dietaryRestrictions = dietaryInput.value.trim();
    console.log('🔧 DEBUG: Surprise Me dietary restrictions:', dietaryRestrictions);
    
    console.log('🔧 DEBUG: Setting loading state...');
    setRecipeSuggestionsLoading(true, "a delightful surprise");
    console.log('🔧 DEBUG: Loading state set');
    
    if (!isUnitUpdatingRecipes) {
        console.log('🔧 DEBUG: Setting surprise me state variables');
        lastFetchWasSurprise = true;
        lastUserIngredients = null;
        lastUserDietary = dietaryRestrictions;
    }
    
    // Track surprise me intent
    const surpriseData = {
        dietary_restrictions: dietaryRestrictions || null,
        search_type: 'surprise',
        timestamp: new Date().toISOString()
    };
    let seedForCurrentApiCall = isUnitUpdatingRecipes && lastSuccessfulFetchSeed !== null ? lastSuccessfulFetchSeed : Math.floor(Math.random() * 1000000);
    const unitInstructions = currentUnitSystem === 'us' ? "US Customary units" : "Metric units";
    const recipeObjectJsonFormat = `"name": "Recipe Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 item"], "instructions": ["1 step"]`;
    let dietaryClause = dietaryRestrictions ? `Strictly adhere to: "${dietaryRestrictions}".` : "";
    const promptUserMessage = `Surprise me with 4 distinct "mealPairings". Each MUST include: "mainRecipe" & "sideRecipe" object (side can be dessert). Use ${unitInstructions}. ${dietaryClause} Both recipes MUST contain: ${recipeObjectJsonFormat}. All fields mandatory & non-empty. 'ingredients' & 'instructions' arrays MUST NOT be empty. Each "mealTitle" must be a creative, descriptive name for the meal pairing (e.g., "Tuscan Sunset", "Cozy Winter Evening", "Tropical Paradise"). JSON: {"mealPairings": [{"mealTitle": "Creative Meal Name Here", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. RESPOND ONLY WITH VALID JSON. NO OTHER TEXT.`;

    console.log('🔧 DEBUG: About to call OpenAI for Surprise Me...');
    try {
        const messages = [
            { role: 'system', content: RECIPE_GENERATION_INSTRUCTION },
            { role: 'user', content: promptUserMessage }
        ];
        
        console.log('🔧 DEBUG: Calling OpenAI with messages:', messages);
        const response = await callOpenAI(messages, 0.5); // Moderate temperature for creative but structured JSON
        console.log('🔧 DEBUG: Got OpenAI response:', response);
        console.log('🔧 DEBUG: Starting JSON parsing...');
        let jsonStrToParse = response.trim();
        
        // Clean up response if it's wrapped in code blocks
        const match = jsonStrToParse.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
        if (match && match[1]) {
            jsonStrToParse = match[1].trim();
        }
        
        if (!jsonStrToParse) throw new Error("Empty AI response for surprise.");
        const data = JSON.parse(jsonStrToParse);
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall;
        displayResults(data, 'surprise');
        
        // Track successful surprise request
        await trackUserIntent({
            intent_type: 'surprise_me',
            intent_data: {
                ...surpriseData,
                results_count: data.mealPairings?.length || 0,
                unit_system: currentUnitSystem
            },
            user_input: dietaryRestrictions ? `Surprise me (Dietary: ${dietaryRestrictions})` : 'Surprise me',
            success: true
        });
    } catch (error: any) {
        console.error("Error fetching surprise:", error);
        displayRecipeError("Oops! Sousie couldn't conjure her surprise recipes this time.");
        
        // Track failed surprise request
        await trackUserIntent({
            intent_type: 'surprise_me',
            intent_data: {
                ...surpriseData,
                error_type: error.name || 'Unknown'
            },
            user_input: dietaryRestrictions ? `Surprise me (Dietary: ${dietaryRestrictions})` : 'Surprise me',
            success: false,
            error_message: error.message
        });
    } finally {
        setRecipeSuggestionsLoading(false);
    }
}

function handleRecipePageStartOver() {
    if (isLoadingRecipes || !resultsContainer) return;
    
    // Clear results
    resultsContainer.innerHTML = '';
    
    // Restore the original form
    const recipeFinderForm = document.getElementById('recipe-finder-form');
    if (recipeFinderForm) {
        recipeFinderForm.style.cssText = '';
        recipeFinderForm.className = 'welcome-screen';
        recipeFinderForm.innerHTML = `
            <div class="welcome-icon">
                <i class="fas fa-search"></i>
            </div>
            <h2 class="welcome-title">Recipe Finder</h2>
            <p class="welcome-subtitle">
                Tell me what ingredients you have, and I'll suggest delicious recipes you can make!
            </p>
            <div style="max-width: 400px; width: 100%;">
                <div style="margin-bottom: 16px;">
                    <input id="ingredients-input" type="text" class="chat-input" placeholder="e.g., chicken, potatoes, onions" style="width: 100%; margin-bottom: 12px;" />
                    <input id="dietary-input" type="text" class="chat-input" placeholder="Dietary preferences (optional)" style="width: 100%;" />
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button id="suggest-button" class="btn btn-primary">Find Recipes</button>
                    <button id="surprise-button" class="btn btn-outline">Surprise Me</button>
                    <button id="start-over-button" class="btn btn-outline">Start Over</button>
                </div>
            </div>
        `;
        
        // Re-initialize buttons and get fresh DOM references
        setTimeout(() => {
            initializeRecipeFinderButtons();
            const newIngredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
            if (newIngredientsInput) {
                newIngredientsInput.focus();
            }
        }, 100);
    }
    
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
    lastSuccessfulFetchSeed = null;
}

async function handleRecipePageUnitChange(newSystem: 'us' | 'metric') {
    console.log('🔧 DEBUG: handleRecipePageUnitChange called with:', newSystem, 'current:', currentUnitSystem);
    if (isLoadingRecipes || currentUnitSystem === newSystem) {
        console.log('🔧 DEBUG: Unit change skipped - loading:', isLoadingRecipes, 'same system:', currentUnitSystem === newSystem);
        return;
    }
    const oldSystem = currentUnitSystem;
    updateUnitSystem(newSystem); // Updates global state and button appearance

    const canRefetch = lastUserIngredients || lastFetchWasSurprise;
    if (canRefetch && resultsContainer && resultsContainer.querySelector('.recipe-card')) {
        isUnitUpdatingRecipes = true;
        const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
        const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
        if (coreUsUnitsButton) coreUsUnitsButton.disabled = true;
        if (coreMetricUnitsButton) coreMetricUnitsButton.disabled = true;
        resultsContainer.classList.add('content-stale-for-unit-update');
        // setLoading(true, "units") will show main loading message, which we might not want for just unit change.
        // Or, allow it to show the loading message briefly.
        setRecipeSuggestionsLoading(true, "units");


        const fetchPromise = lastUserIngredients
            ? handleSuggestRecipes(lastUserIngredients)
            : (lastFetchWasSurprise ? handleSurpriseMe() : Promise.resolve());
        try {
            await fetchPromise;
        } catch (error) {
            console.error("Unit change re-fetch failed:", error);
            // Revert unit system if fetch fails? Or display error? For now, keep new system.
            updateUnitSystem(oldSystem); // Revert on error
            displayRecipeError("Failed to update recipes for new units. Please try again.");
        } finally {
            isUnitUpdatingRecipes = false;
            if (resultsContainer) resultsContainer.classList.remove('content-stale-for-unit-update');
            // setLoading(false) is called by the fetch functions.
            // Re-enable unit buttons based on current main loading state
            if (coreUsUnitsButton) coreUsUnitsButton.disabled = isLoadingRecipes;
            if (coreMetricUnitsButton) coreMetricUnitsButton.disabled = isLoadingRecipes;
        }
    }
}


// Chat functionality
function initializeChat() {
    if (!chatMessages) {
        chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
    }
    
    // Clear any existing welcome screen and initialize with conversational message
    if (chatMessages) {
        // Remove welcome screen if it exists
        const welcomeScreen = chatMessages.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.remove();
        }
        
        // Add initial message if chat is empty
        if (chatMessages.children.length === 0) {
            const welcomeMessages = [
                "Hey there! 👋 I'm Sousie, your friendly AI cooking companion! What delicious adventure are we embarking on today?",
                "Hello! 🍳 I'm Sousie, and I'm absolutely thrilled to help you with all things cooking! What's on your culinary mind?",
                "Hi! ✨ Sousie here, ready to dive into the wonderful world of cooking with you! What can I help you whip up today?"
            ];
            const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
            addChatMessage('sousie', welcomeMsg);
            
            // Add conversation starter to history
            conversationHistory.push({ role: 'assistant', content: welcomeMsg });
        }
    }
}

function addChatMessage(sender: 'user' | 'sousie', message: string) {
    if (!chatMessages) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}`;
    
    if (sender === 'sousie') {
        messageEl.innerHTML = `
            <div class="message-header">
                ${panSVG}
                <span>Sousie</span>
            </div>
            <div class="message-content">${sanitizeHTML(message)}</div>
        `;
    } else {
        messageEl.innerHTML = `<div class="message-content">${sanitizeHTML(message)}</div>`;
    }
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to detect if user is asking for recipes
function isRecipeRequest(message: string): boolean {
    const recipeKeywords = [
        'recipe', 'recipes', 'cook', 'cooking', 'make', 'prepare', 'dish', 'meal',
        'ingredient', 'ingredients', 'how to make', 'how do i cook', 'what can i make',
        'dinner', 'lunch', 'breakfast', 'dessert', 'appetizer', 'snack',
        'suggestions', 'suggest', 'recommend', 'ideas', 'what should i',
        'give me', 'show me', 'find me', 'help me', 'i want to eat',
        'i have', 'with these ingredients', 'using'
    ];
    
    // Common food ingredients that often indicate recipe requests
    const foodKeywords = [
        'chicken', 'beef', 'pork', 'fish', 'salmon', 'steak', 'ribeye', 'sirloin',
        'potatoes', 'rice', 'pasta', 'noodles', 'vegetables', 'onions', 'garlic',
        'tomatoes', 'cheese', 'eggs', 'flour', 'butter', 'oil', 'spices'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    // Check for explicit recipe keywords
    const hasRecipeKeyword = recipeKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Check if message contains food ingredients (possible recipe request)
    const hasFoodKeyword = foodKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Context-aware detection: if previous message was about ingredients, current message might be asking for recipes
    const contextualPhrases = ['and', 'with', 'plus', 'also', 'what about', 'how about'];
    const hasContextualPhrase = contextualPhrases.some(phrase => lowerMessage.includes(phrase));
    
    // If message has food keywords and is short (likely ingredient list), treat as recipe request
    const isShortFoodMessage = hasFoodKeyword && message.split(' ').length <= 10;
    
    return hasRecipeKeyword || isShortFoodMessage || (hasFoodKeyword && hasContextualPhrase);
}

// Placeholder function for Weekly Menu
function handleGenerateWeeklyMenu() {
    console.log('🔧 DEBUG: handleGenerateWeeklyMenu called');
    const weeklyMenuDisplay = document.getElementById('weekly-menu-display');
    if (weeklyMenuDisplay) {
        weeklyMenuDisplay.innerHTML = `
            <div class="message info-message">
                ${panSVG} Weekly menu generation is coming soon! This feature will create personalized meal plans.
            </div>
        `;
    }
}

// Placeholder function for Favorites
function handleBrowseFavorites() {
    console.log('🔧 DEBUG: handleBrowseFavorites called');
    const favoritesDisplay = document.getElementById('favorite-recipes-display');
    if (favoritesDisplay) {
        favoritesDisplay.innerHTML = `
            <div class="message info-message">
                ${panSVG} Favorites browsing is coming soon! This will show your saved recipes.
            </div>
        `;
    }
}

async function handleChatMessage(userMessage: string) {
    console.log("💬 DEBUG: handleChatMessage called with:", userMessage);
    if (!userMessage.trim() || !OPENAI_API_KEY) return;
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: userMessage });
    
    // Keep conversation history manageable (last 10 exchanges = 20 messages)
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
    
    // Add user message to UI
    addChatMessage('user', userMessage);
    
    // Check if this is a recipe request
    const isRecipeReq = isRecipeRequest(userMessage);
    console.log("🔍 DEBUG: Recipe request detected:", isRecipeReq);
    
    // Add loading indicator with more dynamic text
    const loadingTexts = isRecipeReq ? [
        "Let me find some delicious recipes for you... 🍳",
        "Searching my recipe collection... 📖",
        "Cooking up some recipe cards... 👨‍🍳",
        "Gathering recipe ideas... ✨"
    ] : [
        "Let me think about that... 🤔",
        "Cooking up a response... 👨‍🍳",
        "Checking my recipe book... 📖",
        "One moment while I gather my thoughts... ✨"
    ];
    const loadingText = loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
    
    const loadingEl = document.createElement('div');
    loadingEl.className = 'chat-message sousie loading';
    loadingEl.innerHTML = `
        <div class="message-header">
            ${panSVG}
            <span>Sousie</span>
        </div>
        <div class="message-content">${loadingText}</div>
    `;
    chatMessages?.appendChild(loadingEl);
    chatMessages!.scrollTop = chatMessages!.scrollHeight;
    
    try {
        let response: string;
        
        if (isRecipeReq) {
            console.log("🍳 DEBUG: Processing as recipe request");
            // Generate structured recipe cards for recipe requests
            const unitInstructions = currentUnitSystem === 'us'
                ? "US Customary units (e.g., cups, oz, lbs, tsp, tbsp)"
                : "Metric units (e.g., ml, grams, kg, L)";
            const recipeObjectJsonFormat = `"name": "Recipe Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 cup flour"], "instructions": ["Preheat."]`;
            
            const promptUserMessage = `Based on this request: "${userMessage}", suggest 3 distinct "mealPairings". Each MUST include: "mainRecipe" object and "sideRecipe" object (could be traditional side or dessert). Use ${unitInstructions}. Both "mainRecipe" and "sideRecipe" objects MUST contain: ${recipeObjectJsonFormat}. All fields are mandatory and non-empty. 'ingredients' and 'instructions' arrays MUST NOT be empty. Each "mealTitle" must be a creative, descriptive name for the meal pairing. KEEP ALL TEXT FIELDS CONCISE (under 200 chars each). Final JSON structure: {"mealPairings": [{"mealTitle": "Creative Meal Name Here", "mainRecipe": {...}, "sideRecipe": {...}}, ...3 pairings]}. RESPOND ONLY WITH VALID, COMPLETE JSON. NO OTHER TEXT.`;
            
            const messages = [
                { role: 'system', content: RECIPE_GENERATION_INSTRUCTION },
                { role: 'user', content: promptUserMessage }
            ];
            
            console.log("🔧 DEBUG: Calling OpenAI for recipes...");
            response = await callOpenAI(messages, 0.3); // Lower temperature for consistent JSON
            console.log("🔧 DEBUG: OpenAI recipe response:", response);
            
            // Clean up response if it's wrapped in code blocks
            let jsonStrToParse = response.trim();
            const match = jsonStrToParse.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
            if (match && match[1]) {
                jsonStrToParse = match[1].trim();
            }
            
            // Additional cleanup for common JSON issues
            jsonStrToParse = jsonStrToParse
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                .trim();
            
            // Try to fix unterminated strings by finding the last complete object
            if (jsonStrToParse.includes('"instructions')) {
                const lastBraceIndex = jsonStrToParse.lastIndexOf('}');
                const lastBracketIndex = jsonStrToParse.lastIndexOf(']');
                if (lastBraceIndex > 0 && lastBracketIndex > lastBraceIndex) {
                    // Try to close the JSON properly
                    const truncated = jsonStrToParse.substring(0, lastBracketIndex + 1);
                    if (truncated.endsWith(']}')) {
                        jsonStrToParse = truncated;
                    }
                }
            }
            
            try {
                const recipeData = JSON.parse(jsonStrToParse);
                console.log("🔧 DEBUG: Recipe data parsed:", recipeData);
                console.log("🔧 DEBUG: About to render recipe cards...");
                
                // Remove loading indicator
                loadingEl.remove();
                
                // Add recipe cards to chat
                const messageEl = document.createElement('div');
                messageEl.className = 'chat-message sousie';
                messageEl.innerHTML = `
                    <div class="message-header">
                        ${panSVG}
                        <span>Sousie</span>
                    </div>
                    <div class="message-content">
                        <p>Here are some delicious recipe ideas for you! 🍳</p>
                        <div class="recipes-grid">
                        </div>
                    </div>
                `;
                
                const recipesGrid = messageEl.querySelector('.recipes-grid');
                if (recipesGrid && recipeData.mealPairings && Array.isArray(recipeData.mealPairings)) {
                    recipeData.mealPairings.forEach((mealPairing: any, index: number) => {
                        if (mealPairing && mealPairing.mainRecipe) {
                            recipesGrid.appendChild(createExpandableRecipeCard(mealPairing, `chat-${index}`, false));
                        }
                    });
                }
                
                chatMessages?.appendChild(messageEl);
                chatMessages!.scrollTop = chatMessages!.scrollHeight;
                
                // Add response to conversation history as descriptive text
                const descriptiveResponse = `I found some great recipes for you! Here are ${recipeData.mealPairings?.length || 0} meal pairing suggestions.`;
                conversationHistory.push({ role: 'assistant', content: descriptiveResponse });
                
                // Track successful recipe request
                await trackUserIntent({
                    intent_type: 'recipe_search',
                    intent_data: { 
                        message_length: userMessage.length,
                        results_count: recipeData.mealPairings?.length || 0,
                        unit_system: currentUnitSystem,
                        search_type: 'chat_recipe_request',
                        timestamp: new Date().toISOString()
                    },
                    user_input: userMessage,
                    success: true
                });
                
                return; // Exit early for recipe requests
                
            } catch (parseError) {
                console.error("Failed to parse recipe JSON, falling back to conversational:", parseError);
                console.error("Raw JSON string that failed to parse:", jsonStrToParse);
                console.error("JSON length:", jsonStrToParse.length);
                
                // Try to extract partial data if possible
                try {
                    // Look for mealPairings array in the response
                    const mealPairingsMatch = jsonStrToParse.match(/"mealPairings"\s*:\s*\[(.*?)\]/s);
                    if (mealPairingsMatch) {
                        console.log("🔧 DEBUG: Found mealPairings in malformed JSON - could implement recovery");
                    }
                } catch (recoveryError) {
                    console.error("JSON recovery also failed:", recoveryError);
                }
                // Fall back to conversational response if JSON parsing fails
            }
        }
        
        // Regular conversational response
        const messages = [
            { role: 'system', content: SOUSIE_SYSTEM_INSTRUCTION },
            ...conversationHistory
        ];
        
        response = await callOpenAI(messages, 0.8); // Higher temperature for more creative responses
        
        // Add assistant response to conversation history
        conversationHistory.push({ role: 'assistant', content: response });
        
        // Remove loading indicator
        loadingEl.remove();
        
        // Add Sousie's response
        addChatMessage('sousie', response);
        
        // Track successful chat intent
        await trackUserIntent({
            intent_type: 'chat_message',
            intent_data: { 
                message_length: userMessage.length,
                response_length: response.length,
                conversation_length: conversationHistory.length,
                timestamp: new Date().toISOString()
            },
            user_input: userMessage,
            ai_response: response,
            success: true
        });
        
    } catch (error: any) {
        console.error('Chat error:', error);
        loadingEl.remove();
        const errorMessage = 'Oops! I\'m having trouble right now. Please try again in a moment. 😅';
        addChatMessage('sousie', errorMessage);
        
        // Track failed chat intent
        await trackUserIntent({
            intent_type: 'chat_message',
            intent_data: { 
                message_length: userMessage.length,
                error_type: error.name || 'Unknown',
                conversation_length: conversationHistory.length,
                timestamp: new Date().toISOString()
            },
            user_input: userMessage,
            ai_response: errorMessage,
            success: false,
            error_message: error.message
        });
    }
}

function clearChatHistory() {
    if (!chatMessages) return;
    
    // Clear conversation history
    conversationHistory = [];
    
    // Clear chat messages from UI
    chatMessages.innerHTML = '';
    
    // Add fresh welcome message
    const welcomeMessages = [
        "Fresh start! 🌟 I'm ready for our new cooking conversation. What would you like to explore?",
        "Chat cleared! ✨ Let's start fresh - what culinary questions can I help you with?",
        "New conversation started! 👨‍🍳 What cooking adventure shall we dive into?"
    ];
    const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    addChatMessage('sousie', welcomeMsg);
    
    // Add to conversation history
    conversationHistory.push({ role: 'assistant', content: welcomeMsg });
    
    // Focus on input
    if (chatInput) {
        chatInput.focus();
    }
    
    // Track the clear action
    trackUserIntent({
        intent_type: 'chat_message',
        intent_data: { 
            action: 'clear_chat',
            timestamp: new Date().toISOString()
        },
        user_input: 'Clear chat history',
        success: true
    });
}

// View-specific initialization functions
function initializeRecipeFinderButtons() {
    console.log('🔧 DEBUG: ===== INITIALIZING RECIPE FINDER BUTTONS =====');
    
    // Refresh DOM references for Recipe Finder view
    ingredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
    dietaryInput = document.getElementById('dietary-input') as HTMLInputElement;
    resultsContainer = document.getElementById('results-container') as HTMLDivElement;
    
    console.log('🔧 DEBUG: DOM elements after refresh:', {
        ingredientsInput,
        dietaryInput,
        resultsContainer
    });
    
    const suggestBtn = document.getElementById('suggest-button') as HTMLButtonElement;
    const surpriseBtn = document.getElementById('surprise-button') as HTMLButtonElement;
    const startOverBtn = document.getElementById('start-over-button') as HTMLButtonElement;
    
    console.log('🔧 DEBUG: Recipe Finder elements found:', {
        suggestBtn: !!suggestBtn,
        surpriseBtn: !!surpriseBtn,
        startOverBtn: !!startOverBtn,
        ingredientsInput: !!ingredientsInput,
        dietaryInput: !!dietaryInput,
        resultsContainer: !!resultsContainer
    });
    
    // Remove existing listeners by cloning elements (clean approach)
    if (suggestBtn) {
        console.log('🔧 DEBUG: Setting up Suggest Recipes button');
        const newSuggestBtn = suggestBtn.cloneNode(true) as HTMLButtonElement;
        suggestBtn.parentNode?.replaceChild(newSuggestBtn, suggestBtn);
        newSuggestBtn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('🔧 DEBUG: ===== SUGGEST RECIPES BUTTON CLICKED =====');
            handleSuggestRecipes();
        });
        console.log('🔧 DEBUG: Suggest Recipes event listener attached');
    } else {
        console.error('🔧 DEBUG: Suggest button NOT FOUND!');
    }
    
    if (surpriseBtn) {
        console.log('🔧 DEBUG: Setting up Surprise Me button');
        const newSurpriseBtn = surpriseBtn.cloneNode(true) as HTMLButtonElement;
        surpriseBtn.parentNode?.replaceChild(newSurpriseBtn, surpriseBtn);
        newSurpriseBtn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('🔧 DEBUG: ===== SURPRISE ME BUTTON CLICKED =====');
            handleSurpriseMe();
        });
        console.log('🔧 DEBUG: Surprise Me event listener attached');
    } else {
        console.error('🔧 DEBUG: Surprise button NOT FOUND!');
    }
    
    if (startOverBtn) {
        const newStartOverBtn = startOverBtn.cloneNode(true) as HTMLButtonElement;
        startOverBtn.parentNode?.replaceChild(newStartOverBtn, startOverBtn);
        newStartOverBtn.addEventListener('click', () => {
            console.log('🔧 DEBUG: Start Over clicked');
            handleRecipePageStartOver();
        });
    }
    
    // Add Enter key listeners for inputs
    if (ingredientsInput) {
        ingredientsInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSuggestRecipes();
            }
        });
    }
    
    if (dietaryInput) {
        dietaryInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSuggestRecipes();
            }
        });
    }
}

function initializeMenuPlannerButtons() {
    console.log('🔧 DEBUG: ===== INITIALIZING MENU PLANNER BUTTONS =====');
    
    const weeklyMenuBtn = document.getElementById('generate-weekly-menu-button') as HTMLButtonElement;
    console.log('🔧 DEBUG: Weekly menu button found:', !!weeklyMenuBtn);
    console.log('🔧 DEBUG: Weekly menu button element:', weeklyMenuBtn);
    
    if (weeklyMenuBtn) {
        console.log('🔧 DEBUG: Setting up Weekly Menu button');
        const newWeeklyMenuBtn = weeklyMenuBtn.cloneNode(true) as HTMLButtonElement;
        weeklyMenuBtn.parentNode?.replaceChild(newWeeklyMenuBtn, weeklyMenuBtn);
        newWeeklyMenuBtn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('🔧 DEBUG: ===== WEEKLY MENU BUTTON CLICKED =====');
            handleGenerateWeeklyMenu();
        });
        console.log('🔧 DEBUG: Weekly Menu event listener attached');
    } else {
        console.error('🔧 DEBUG: Weekly Menu button NOT FOUND!');
    }
}

function initializeFavoritesButtons() {
    console.log('🔧 DEBUG: Initializing Favorites buttons');
    
    const favoritesButtons = document.querySelectorAll('#favorites-view .btn-primary');
    console.log('🔧 DEBUG: Favorites buttons found:', favoritesButtons.length);
    
    favoritesButtons.forEach(button => {
        const btn = button as HTMLButtonElement;
        const newBtn = btn.cloneNode(true) as HTMLButtonElement;
        btn.parentNode?.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            console.log('🔧 DEBUG: Browse Favorites clicked');
            handleBrowseFavorites();
        });
    });
}

// Navigation functionality
function initializeNavigation() {
    if (!navItems || !viewContents) return;
    
    Array.from(navItems).forEach(navItem => {
        navItem.addEventListener('click', () => {
            const targetView = navItem.dataset.view;
            if (!targetView) return;
            
            // Update nav items
            Array.from(navItems!).forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
            
            // Update view contents
            Array.from(viewContents!).forEach(view => view.classList.remove('active'));
            const targetViewEl = document.getElementById(`${targetView}-view`);
            if (targetViewEl) {
                targetViewEl.classList.add('active');
                
                // Initialize view-specific functionality
                console.log('🔧 DEBUG: Initializing view-specific functionality for:', targetView);
                if (targetView === 'chat') {
                    console.log('🔧 DEBUG: Initializing chat view');
                    initializeChat();
                } else if (targetView === 'recipes') {
                    console.log('🔧 DEBUG: Initializing recipes view');
                    initializeRecipeFinderButtons();
                } else if (targetView === 'menu') {
                    console.log('🔧 DEBUG: Initializing menu view');
                    initializeMenuPlannerButtons();
                } else if (targetView === 'favorites') {
                    console.log('🔧 DEBUG: Initializing favorites view');
                    initializeFavoritesButtons();
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalFunctionality(); // Sets up common elements, auth, modals
    initializeDOMReferences(); // Sets up elements specific to this page
    initializeNavigation(); // Sets up navigation
    initializeChat(); // Initialize chat
    
    // Initialize buttons for views that might be visible on load
    setTimeout(() => {
        initializeRecipeFinderButtons(); // Recipe Finder may be active
        console.log('🔧 DEBUG: Initial Recipe Finder button initialization complete');
    }, 100); // Small delay to ensure DOM is ready

    if (!OPENAI_API_KEY && resultsContainer) {
        resultsContainer.innerHTML = `<div class="message error-message">${panSVG} Configuration error: Sousie's AI brain is offline (API_KEY missing). Some features will be disabled.</div>`;
        // Disable AI specific buttons
        if (suggestButton) suggestButton.disabled = true;
        if (surpriseButton) surpriseButton.disabled = true;
    } else if (resultsContainer && resultsContainer.innerHTML.trim() === '') {
         resultsContainer.innerHTML = `<div class="message info-message">${panSVG}Welcome to Sousie's Kitchen! What delicious ingredients are we working with today? Or try a 'Surprise Me!'</div>`;
    }

    // Recipe finder event listeners moved to view-specific initialization

    // Chat event listeners
    if (chatInput && chatSendButton) {
        chatSendButton.addEventListener('click', () => {
            const message = chatInput!.value.trim();
            if (message) {
                handleChatMessage(message);
                chatInput!.value = '';
            }
        });
        
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const message = chatInput!.value.trim();
                if (message) {
                    handleChatMessage(message);
                    chatInput!.value = '';
                }
            }
        });
    }
    
    // Clear chat button
    if (clearChatButton) {
        clearChatButton.addEventListener('click', clearChatHistory);
    }
    
    // Suggested questions event listeners
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('suggestion')) {
            const question = target.getAttribute('data-question') || target.textContent;
            if (question && chatInput) {
                handleChatMessage(question);
            }
        }
    });

    // Weekly Menu and Favorites event listeners moved to view-specific initialization

    // Unit change event listeners
    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    
    console.log('🔧 DEBUG: Unit buttons found:', { usButton: !!coreUsUnitsButton, metricButton: !!coreMetricUnitsButton });
    
    if(coreUsUnitsButton) {
        coreUsUnitsButton.addEventListener('click', () => {
            console.log('🔧 DEBUG: US button clicked');
            handleRecipePageUnitChange('us');
        });
    }
    if(coreMetricUnitsButton) {
        coreMetricUnitsButton.addEventListener('click', () => {
            console.log('🔧 DEBUG: Metric button clicked');
            handleRecipePageUnitChange('metric');
        });
    }

});
