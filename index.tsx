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
    console.log("🔧 DEBUG: handleSuggestRecipes called");
    if (!OPENAI_API_KEY || isLoadingRecipes || !ingredientsInput || !dietaryInput) return;
    const ingredients = ingredientsQuery || ingredientsInput.value.trim();
    const dietaryRestrictions = dietaryInput.value.trim();

    if (!ingredients) {
        displayRecipeError("Sousie needs some ingredients to work her magic! Please enter some.");
        return;
    }
    
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

    const promptUserMessage = `I have: "${ingredientList.join(' and ')}". Suggest 4 distinct "mealPairings". Each MUST include: "mainRecipe" object and "sideRecipe" object (could be traditional side or dessert). Use ${unitInstructions}. ${dietaryClause} Both "mainRecipe" and "sideRecipe" objects MUST contain: ${recipeObjectJsonFormat}. All fields are mandatory and non-empty. 'ingredients' and 'instructions' arrays MUST NOT be empty. Final JSON structure: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. RESPOND ONLY WITH VALID JSON. NO OTHER TEXT.`;

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
    if (!OPENAI_API_KEY || isLoadingRecipes || !dietaryInput) return;
    const dietaryRestrictions = dietaryInput.value.trim();
    setRecipeSuggestionsLoading(true, "a delightful surprise");
    if (!isUnitUpdatingRecipes) {
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
    const promptUserMessage = `Surprise me with 4 distinct "mealPairings". Each MUST include: "mainRecipe" & "sideRecipe" object (side can be dessert). Use ${unitInstructions}. ${dietaryClause} Both recipes MUST contain: ${recipeObjectJsonFormat}. All fields mandatory & non-empty. 'ingredients' & 'instructions' arrays MUST NOT be empty. JSON: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. RESPOND ONLY WITH VALID JSON. NO OTHER TEXT.`;

    try {
        const messages = [
            { role: 'system', content: RECIPE_GENERATION_INSTRUCTION },
            { role: 'user', content: promptUserMessage }
        ];
        
        const response = await callOpenAI(messages, 0.5); // Moderate temperature for creative but structured JSON
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
    
    // Add loading indicator with more dynamic text
    const loadingTexts = [
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
        // Build messages with conversation context
        const messages = [
            { role: 'system', content: SOUSIE_SYSTEM_INSTRUCTION },
            ...conversationHistory
        ];
        
        const response = await callOpenAI(messages, 0.8); // Higher temperature for more creative responses
        
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
    
    // Clear chat button
    if (clearChatButton) {
        clearChatButton.addEventListener('click', clearChatHistory);
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
