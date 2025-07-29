/**
 * index.tsx - Main script for Sousie Single Page Application
 */
import {
    currentUser, currentUnitSystem,
    initializeGlobalFunctionality,
    sanitizeHTML, generateDynamicLoadingMessage,
    createExpandableRecipeCard, updateUnitSystem, panSVG
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
let suggestedQuestions: HTMLDivElement | null;

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

// Sousie system instruction
const SOUSIE_SYSTEM_INSTRUCTION = "You are Sousie, a friendly and creative AI cooking assistant. You help people with cooking, recipes, meal planning, ingredient substitutions, cooking techniques, and food-related questions. Be encouraging, helpful, and slightly whimsical in your responses. Always provide practical and actionable advice. When suggesting recipes, be specific about ingredients and instructions. You can also help with meal planning, dietary restrictions, and cooking tips.";


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
    suggestedQuestions = document.getElementById('suggested-questions') as HTMLDivElement;
    
    // Navigation elements
    navItems = document.querySelectorAll('.nav-item');
    viewContents = document.querySelectorAll('.view-content');
}

function setRecipeSuggestionsLoading(loading: boolean, ingredientsForLoadingMessage?: string) {
    isLoadingRecipes = loading;
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
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        const errorElement = document.createElement('div');
        errorElement.className = 'message error-message';
        errorElement.textContent = message; // sanitizeHTML(message) if message could be unsafe
        resultsContainer.appendChild(errorElement);
    }
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
}


function displayResults(data: any, type: 'recipes' | 'surprise') {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (data.mealPairings && Array.isArray(data.mealPairings) && data.mealPairings.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'recipes-grid';
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
    } else {
        resultsContainer.innerHTML = `<div class="message info-message">${panSVG} Sousie pondered, but couldn't find specific meal pairings for that. Try different ingredients or ask for a surprise!</div>`;
    }
    resultsContainer.scrollTop = 0;
}

// OpenAI API call function
async function callOpenAI(messages: any[], temperature: number = 0.7): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }
    
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
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

async function handleSuggestRecipes(ingredientsQuery?: string) {
    if (!OPENAI_API_KEY || isLoadingRecipes || !ingredientsInput || !dietaryInput) return;
    const ingredients = ingredientsQuery || ingredientsInput.value.trim();
    const dietaryRestrictions = dietaryInput.value.trim();

    if (!ingredients) {
        displayRecipeError("Sousie needs some ingredients to work her magic! Please enter some.");
        return;
    }

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

    const promptUserMessage = `I have: "${ingredientList.join(' and ')}". Suggest 4 distinct "mealPairings". Each MUST include: "mainRecipe" object and "sideRecipe" object (could be traditional side or dessert). Use ${unitInstructions}. ${dietaryClause} Both "mainRecipe" and "sideRecipe" objects MUST contain: ${recipeObjectJsonFormat}. All fields are mandatory and non-empty. 'ingredients' and 'instructions' arrays MUST NOT be empty. Final JSON structure: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. Only provide the JSON.`;

    try {
        const messages = [
            { role: 'system', content: SOUSIE_SYSTEM_INSTRUCTION },
            { role: 'user', content: promptUserMessage }
        ];
        
        const response = await callOpenAI(messages, 0.7);
        let jsonStrToParse = response.trim();
        
        // Clean up response if it's wrapped in code blocks
        const match = jsonStrToParse.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
        if (match && match[1]) {
            jsonStrToParse = match[1].trim();
        }
        
        if (!jsonStrToParse) throw new Error("Empty AI response for recipe suggestions.");
        const data = JSON.parse(jsonStrToParse);
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall;
        displayResults(data, 'recipes');
    } catch (error: any) {
        console.error("Error suggesting recipes:", error);
        displayRecipeError("Oh no! Sousie had trouble fetching recipes. Check ingredients or try again.");
    } finally {
        setRecipeSuggestionsLoading(false);
    }
}

async function handleSurpriseMe() {
    if (!OPENAI_API_KEY || isLoadingRecipes || !dietaryInput) return;
    const dietaryRestrictions = dietaryInput.value.trim();
    setRecipeSuggestionsLoading(true, "a delightful surprise");
    if (!isUnitUpdatingRecipes) {
        lastFetchWasSurprise = true;
        lastUserIngredients = null;
        lastUserDietary = dietaryRestrictions;
    }
    let seedForCurrentApiCall = isUnitUpdatingRecipes && lastSuccessfulFetchSeed !== null ? lastSuccessfulFetchSeed : Math.floor(Math.random() * 1000000);
    const unitInstructions = currentUnitSystem === 'us' ? "US Customary units" : "Metric units";
    const recipeObjectJsonFormat = `"name": "Recipe Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 item"], "instructions": ["1 step"]`;
    let dietaryClause = dietaryRestrictions ? `Strictly adhere to: "${dietaryRestrictions}".` : "";
    const promptUserMessage = `Surprise me with 4 distinct "mealPairings". Each MUST include: "mainRecipe" & "sideRecipe" object (side can be dessert). Use ${unitInstructions}. ${dietaryClause} Both recipes MUST contain: ${recipeObjectJsonFormat}. All fields mandatory & non-empty. 'ingredients' & 'instructions' arrays MUST NOT be empty. JSON: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. Only JSON.`;

    try {
        const messages = [
            { role: 'system', content: SOUSIE_SYSTEM_INSTRUCTION },
            { role: 'user', content: promptUserMessage }
        ];
        
        const response = await callOpenAI(messages, 0.9); // Higher temperature for more creative surprises
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
    } catch (error) {
        console.error("Error fetching surprise:", error);
        displayRecipeError("Oops! Sousie couldn't conjure her surprise recipes this time.");
    } finally {
        setRecipeSuggestionsLoading(false);
    }
}

function handleRecipePageStartOver() {
    if (isLoadingRecipes || !ingredientsInput || !dietaryInput || !resultsContainer) return;
    ingredientsInput.value = '';
    dietaryInput.value = '';
    resultsContainer.innerHTML = `<div class="message info-message">${panSVG}Ready for new ideas! What ingredients does Sousie have to work with today?</div>`;
    ingredientsInput.focus();
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
    lastSuccessfulFetchSeed = null;
}

async function handleRecipePageUnitChange(newSystem: 'us' | 'metric') {
    if (isLoadingRecipes || currentUnitSystem === newSystem) return;
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
    
    // Initialize chat with welcome message
    if (chatMessages && chatMessages.children.length === 0) {
        addChatMessage('sousie', 'Hello! I\'m Sousie, your AI cooking assistant! 🍳 Ask me anything about cooking, recipes, or food. How can I help you today?');
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

async function handleChatMessage(userMessage: string) {
    if (!userMessage.trim() || !OPENAI_API_KEY) return;
    
    // Add user message
    addChatMessage('user', userMessage);
    
    // Add loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'chat-message sousie loading';
    loadingEl.innerHTML = `
        <div class="message-header">
            ${panSVG}
            <span>Sousie</span>
        </div>
        <div class="message-content">Thinking...</div>
    `;
    chatMessages?.appendChild(loadingEl);
    chatMessages!.scrollTop = chatMessages!.scrollHeight;
    
    try {
        const messages = [
            { role: 'system', content: SOUSIE_SYSTEM_INSTRUCTION },
            { role: 'user', content: userMessage }
        ];
        
        const response = await callOpenAI(messages, 0.7);
        
        // Remove loading indicator
        loadingEl.remove();
        
        // Add Sousie's response
        addChatMessage('sousie', response);
        
    } catch (error: any) {
        console.error('Chat error:', error);
        loadingEl.remove();
        addChatMessage('sousie', 'Oops! I\'m having trouble right now. Please try again in a moment.');
    }
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
                if (targetView === 'chat') {
                    initializeChat();
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

    if (!OPENAI_API_KEY && resultsContainer) {
        resultsContainer.innerHTML = `<div class="message error-message">${panSVG} Configuration error: Sousie's AI brain is offline (API_KEY missing). Some features will be disabled.</div>`;
        // Disable AI specific buttons
        if (suggestButton) suggestButton.disabled = true;
        if (surpriseButton) surpriseButton.disabled = true;
    } else if (resultsContainer && resultsContainer.innerHTML.trim() === '') {
         resultsContainer.innerHTML = `<div class="message info-message">${panSVG}Welcome to Sousie's Kitchen! What delicious ingredients are we working with today? Or try a 'Surprise Me!'</div>`;
    }

    // Recipe finder event listeners
    if (suggestButton && ingredientsInput && dietaryInput) {
        suggestButton.addEventListener('click', () => handleSuggestRecipes());
        ingredientsInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); handleSuggestRecipes(); }
        });
        dietaryInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); handleSuggestRecipes(); }
        });
    }
    if (surpriseButton) surpriseButton.addEventListener('click', handleSurpriseMe);
    if (startOverButton) startOverButton.addEventListener('click', handleRecipePageStartOver);

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
    
    // Suggested questions event listeners
    if (suggestedQuestions) {
        const suggestionBtns = suggestedQuestions.querySelectorAll('.suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.textContent;
                if (question && chatInput) {
                    chatInput.value = question;
                    handleChatMessage(question);
                    chatInput.value = '';
                }
            });
        });
    }

    // Unit change event listeners
    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if(coreUsUnitsButton) coreUsUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('us'));
    if(coreMetricUnitsButton) coreMetricUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('metric'));

});
