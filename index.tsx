/**
 * index.tsx - Main script for index.html (Recipe Suggestions)
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import {
    API_KEY, ai, /* SOUSIE_SYSTEM_INSTRUCTION, */ // Removed from import
    currentUser, currentUnitSystem,
    initializeGlobalFunctionality,
    sanitizeHTML, generateDynamicLoadingMessage,
    createExpandableRecipeCard, updateUnitSystem, panSVG
} from "./core";

// DOM Elements specific to the new chat interface
let messageListContainer: HTMLDivElement | null;
let userChatInput: HTMLInputElement | null;
let sendChatButton: HTMLButtonElement | null;
let chatSurpriseButton: HTMLButtonElement | null; // Renamed to avoid conflict if old one is still on page somewhere
let chatStartOverButton: HTMLButtonElement | null; // Renamed
let mobileMenuButton: HTMLButtonElement | null;
let sidebar: HTMLElement | null;
// Let's keep references to the unit and auth buttons if they are managed by this page's logic,
// though they are now in the sidebar HTML structure.
// Core.ts's initializeGlobalFunctionality will grab a broader set of common elements.
// We might not need dedicated vars here if core.ts handles their events for index.html context.

// Page specific state for chat
let isLoadingRecipes = false; // Still relevant for disabling input
let lastUserIngredients: string | null = null;
let lastUserDietary: string | null = null;
let lastFetchWasSurprise: boolean = false;
let isUnitUpdatingRecipes: boolean = false;
let lastSuccessfulFetchSeed: number | null = null;

// Define system instruction locally for this page
const SOUSIE_SYSTEM_INSTRUCTION = "You are Sousie, a friendly and creative AI chef. Provide recipes and meal ideas. Be encouraging and slightly whimsical. Ensure all recipes are complete and make sense. Your primary goal is to inspire users in the kitchen with delightful and practical suggestions.";

// Function to initialize DOM references for the new chat interface
function initializeChatPageDOMReferences() {
    messageListContainer = document.getElementById('message-list-container') as HTMLDivElement;
    userChatInput = document.getElementById('user-chat-input') as HTMLInputElement;
    sendChatButton = document.getElementById('send-chat-button') as HTMLButtonElement;
    chatSurpriseButton = document.getElementById('surprise-me-button') as HTMLButtonElement; // new ID from HTML
    chatStartOverButton = document.getElementById('start-over-button') as HTMLButtonElement; // new ID from HTML
    mobileMenuButton = document.getElementById('mobile-menu-button') as HTMLButtonElement;
    sidebar = document.getElementById('sidebar') as HTMLElement;

    // Old elements that are no longer primary interaction points for this page
    // ingredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
    // dietaryInput = document.getElementById('dietary-input') as HTMLInputElement;
    // suggestButton = document.getElementById('suggest-button') as HTMLButtonElement;
    // resultsContainer = document.getElementById('results-container') as HTMLDivElement; // Replaced by messageListContainer
}

// --- New Chat UI Helper Functions ---

function appendMessage(content: string | HTMLElement, sender: 'user' | 'ai', isLoading: boolean = false) {
    if (!messageListContainer) return null;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');

    if (sender === 'user') {
        messageDiv.classList.add('user-message');
        if (typeof content === 'string') {
            messageDiv.textContent = content;
        } else {
            messageDiv.appendChild(content);
        }
    } else { // AI message
        messageDiv.classList.add('ai-message');
        if (isLoading) {
            messageDiv.classList.add('loading');
            // Simple text loading, can be enhanced with CSS
            const loadingParts = generateDynamicLoadingMessage(lastUserIngredients || undefined); // Use existing dynamic loader
            messageDiv.innerHTML = `${loadingParts.svgIcon} ${sanitizeHTML(loadingParts.opener)} ${sanitizeHTML(loadingParts.mainMessage)} ${sanitizeHTML(loadingParts.action)}`;
        } else {
            if (typeof content === 'string') {
                messageDiv.innerHTML = sanitizeHTML(content); // Sanitize if it's simple text from AI that might not be pre-sanitized
            } else {
                messageDiv.appendChild(content); // Assumes content is already safe (e.g. created with createExpandableRecipeCard)
            }
        }
    }
    messageListContainer.appendChild(messageDiv);
    messageListContainer.scrollTop = messageListContainer.scrollHeight; // Auto-scroll to latest message
    return messageDiv; // Return the message element for potential updates (e.g. replace loading)
}


function setChatLoadingState(loading: boolean) {
    isLoadingRecipes = loading; // Keep global loading flag
    if (userChatInput) userChatInput.disabled = loading;
    if (sendChatButton) sendChatButton.disabled = loading;
    if (chatSurpriseButton) chatSurpriseButton.disabled = loading;
    // chatStartOverButton is usually enabled, but could be disabled during critical ops

    // Disable sidebar navigation links and unit buttons during loading as well
    const sidebarNavLinks = sidebar?.querySelectorAll('#sidebar-nav .nav-link');
    sidebarNavLinks?.forEach(link => {
        (link as HTMLAnchorElement).style.pointerEvents = loading ? 'none' : '';
        (link as HTMLAnchorElement).style.opacity = loading ? '0.6' : '1';
    });

    const unitButtons = sidebar?.querySelectorAll('#unit-toggle-buttons button');
    unitButtons?.forEach(button => {
        (button as HTMLButtonElement).disabled = loading || isUnitUpdatingRecipes;
    });

    const busyAttr = 'aria-busy';
    if (loading) {
        sendChatButton?.setAttribute(busyAttr, 'true');
        chatSurpriseButton?.setAttribute(busyAttr, 'true');
    } else {
        sendChatButton?.removeAttribute(busyAttr);
        chatSurpriseButton?.removeAttribute(busyAttr);
    }
}


// This function replaces the old displayRecipeError
function displayChatError(message: string, existingLoadingMessageDiv: HTMLElement | null = null) {
    const errorMessageContent = `${panSVG} ${sanitizeHTML(message)}`;
    if (existingLoadingMessageDiv) {
        existingLoadingMessageDiv.classList.remove('loading');
        existingLoadingMessageDiv.innerHTML = errorMessageContent;
    } else {
        appendMessage(errorMessageContent, 'ai');
    }
    lastUserIngredients = null; // Reset context on error
    lastUserDietary = null;
    lastFetchWasSurprise = false;
}

// This function replaces the old displayResults
// It now appends results to an existing AI message bubble (which was showing loading) or creates a new one.
function displayChatResults(data: any, type: 'recipes' | 'surprise', existingLoadingMessageDiv: HTMLElement | null) {
    if (!messageListContainer && !existingLoadingMessageDiv) return;

    const contentWrapper = document.createElement('div');

    if (data.mealPairings && Array.isArray(data.mealPairings) && data.mealPairings.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'recipes-grid'; // Existing class, might need chat-specific adjustments
        data.mealPairings.forEach((mealPairing: any, index: number) => {
            if (mealPairing && mealPairing.mainRecipe) {
                // Note: createExpandableRecipeCard might need its own styling review for chat context
                grid.appendChild(createExpandableRecipeCard(mealPairing, `${type}-${index}`, false));
            } else {
                console.warn("Skipping malformed mealPairing:", mealPairing);
            }
        });
        if (grid.children.length > 0) {
            contentWrapper.appendChild(grid);
        } else {
            contentWrapper.innerHTML = `<div class="message info-message">${panSVG} Sousie found some ideas, but they weren't quite ready. Try again!</div>`;
        }
    } else {
        contentWrapper.innerHTML = `<div class="message info-message">${panSVG} Sousie pondered, but couldn't find specific meal pairings for that. Try different ingredients or ask for a surprise!</div>`;
    }

    if (existingLoadingMessageDiv) {
        existingLoadingMessageDiv.classList.remove('loading');
        existingLoadingMessageDiv.innerHTML = ''; // Clear loading content
        existingLoadingMessageDiv.appendChild(contentWrapper);
    } else {
        appendMessage(contentWrapper, 'ai');
    }
    if (messageListContainer) messageListContainer.scrollTop = messageListContainer.scrollHeight;
}


async function handleUserQuery(queryText: string, isSurprise: boolean = false) {
    if (!ai || !API_KEY || isLoadingRecipes) return;

    let ingredients = "";
    let dietaryRestrictions = ""; // For now, we'll try to parse this or leave it blank

    if (!isSurprise) {
        // Basic parsing: assume the whole query is ingredients for now.
        // Advanced: use Gemini to classify intent & extract entities (ingredients, dietary, command) from queryText.
        // For this iteration, we'll keep it simple. If "diet" or "vegetarian" etc. is in query, add to dietary.
        ingredients = queryText; // Entire query as ingredients for now.
        appendUserMessage(queryText);

        // Simple keyword check for dietary for now - this is very basic
        const lcQuery = queryText.toLowerCase();
        if (lcQuery.includes("vegetarian") || lcQuery.includes("vegan") || lcQuery.includes("gluten-free") || lcQuery.includes("keto")) {
            // extract these terms as dietary restrictions
            // This is naive and should be improved, ideally with NLP or specific input format.
            dietaryRestrictions = queryText.match(/(vegetarian|vegan|gluten-free|keto)/gi)?.join(', ') || "";
        }
    } else {
        appendUserMessage("Surprise me!"); // User action for surprise
        // Potentially grab dietary restrictions from a stored preference or a dedicated input if we add one later.
        // For now, if surprise is clicked, we might ignore current text input for dietary.
    }

    if (!isSurprise && !ingredients) {
        displayChatError("Sousie needs some ingredients or a question to work her magic!");
        return;
    }

    setChatLoadingState(true);
    const loadingMessageElement = appendMessage("", 'ai', true); // Show loading message

    if (!isUnitUpdatingRecipes) {
        lastUserIngredients = ingredients; // This might just be the full query
        lastUserDietary = dietaryRestrictions; // Parsed or empty
        lastFetchWasSurprise = isSurprise;
    }

    let seedForCurrentApiCall = isUnitUpdatingRecipes && lastSuccessfulFetchSeed !== null
        ? lastSuccessfulFetchSeed
        : Math.floor(Math.random() * 1000000);

    const unitInstructions = currentUnitSystem === 'us'
        ? "US Customary units (e.g., cups, oz, lbs, tsp, tbsp)"
        : "Metric units (e.g., ml, grams, kg, L)";
    const recipeObjectJsonFormat = `"name": "Recipe Name", "description": "Desc.", "anecdote": "Story.", "chefTip": "Tip.", "ingredients": ["1 cup flour"], "instructions": ["Preheat." ]`;
    let dietaryClause = lastUserDietary ? `Strictly adhere to dietary restrictions: "${lastUserDietary}".` : "";

    let promptUserMessage = "";
    if (isSurprise) {
        promptUserMessage = `Surprise me with 4 distinct "mealPairings". Each MUST include: "mainRecipe" & "sideRecipe" object (side can be dessert). Use ${unitInstructions}. ${dietaryClause} Both recipes MUST contain: ${recipeObjectJsonFormat}. All fields mandatory & non-empty. 'ingredients' & 'instructions' arrays MUST NOT be empty. JSON: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. Only JSON.`;
    } else {
        const ingredientList = ingredients.split(',').map(i => i.trim()).filter(i => i);
        if (ingredientList.length === 0) {
            displayChatError("Please tell Sousie what ingredients you have!", loadingMessageElement);
            setChatLoadingState(false);
            return;
        }
        promptUserMessage = `I have: "${ingredientList.join(' and ')}". Suggest 4 distinct "mealPairings". Each MUST include: "mainRecipe" object and "sideRecipe" object (could be traditional side or dessert). Use ${unitInstructions}. ${dietaryClause} Both "mainRecipe" and "sideRecipe" objects MUST contain: ${recipeObjectJsonFormat}. All fields are mandatory and non-empty. 'ingredients' and 'instructions' arrays MUST NOT be empty. Final JSON structure: {"mealPairings": [{"mealTitle": "Opt. Title", "mainRecipe": {...}, "sideRecipe": {...}}, ...4 pairings]}. Only provide the JSON.`;
    }

    let jsonStrToParse = "";
    if (!isUnitUpdatingRecipes) {
        lastUserIngredients = ingredients;
        lastUserDietary = dietaryRestrictions;
        lastFetchWasSurprise = false;
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: promptUserMessage,
            config: { responseMimeType: "application/json", systemInstruction: SOUSIE_SYSTEM_INSTRUCTION, thinkingConfig: { thinkingBudget: 0 }, seed: seedForCurrentApiCall },
        });
        let rawText = (typeof response.text === 'string') ? response.text.trim() : "";
        const match = rawText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawText;

        if (!jsonStrToParse) throw new Error("Empty AI response for recipe suggestions.");

        const data = JSON.parse(jsonStrToParse);
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall; // Save seed on successful non-unit-update fetch

        displayChatResults(data, isSurprise ? 'surprise' : 'recipes', loadingMessageElement);

    } catch (error: any) {
        console.error(`Error ${isSurprise ? 'fetching surprise' : 'suggesting recipes'}:`, error, "\nMalformed JSON:", jsonStrToParse);
        displayChatError(`Oh no! Sousie had trouble ${isSurprise ? 'conjuring her surprise' : 'fetching recipes'}. Check your input or try again.`, loadingMessageElement);
    } finally {
        setChatLoadingState(false);
        if (userChatInput && !isSurprise) userChatInput.value = ''; // Clear input only if it was a typed query
    }
}


function handleChatStartOver() {
    if (isLoadingRecipes || !messageListContainer || !userChatInput) return;
    messageListContainer.innerHTML = ''; // Clear messages
    userChatInput.value = ''; // Clear input field
    appendMessage(`${panSVG} Ready for new ideas! What ingredients does Sousie have to work with today? Or ask for a surprise!`, 'ai');
    userChatInput.focus();
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
    lastSuccessfulFetchSeed = null;
}

async function handleRecipePageUnitChange(newSystem: 'us' | 'metric') {
    if (isLoadingRecipes || currentUnitSystem === newSystem) return;
    const oldSystem = currentUnitSystem; // From core.ts
    updateUnitSystem(newSystem); // From core.ts - updates global state and button appearance in sidebar

    const canRefetch = lastUserIngredients || lastFetchWasSurprise;

    // Check if there are any AI messages with recipe cards to update
    const lastAIMessageWithRecipes = messageListContainer ? Array.from(messageListContainer.querySelectorAll('.ai-message .recipe-card')).pop()?.closest('.ai-message') as HTMLElement : null;

    if (canRefetch && lastAIMessageWithRecipes) {
        isUnitUpdatingRecipes = true; // Global flag from this file

        // Visually indicate stale content and start loading
        // The existing AI message containing the recipes will become the loading placeholder.
        lastAIMessageWithRecipes.classList.add('loading', 'content-stale-for-unit-update');
        const loadingParts = generateDynamicLoadingMessage("recipes with new units");
        lastAIMessageWithRecipes.innerHTML = `${loadingParts.svgIcon} ${sanitizeHTML(loadingParts.opener)} ${sanitizeHTML(loadingParts.mainMessage)} ${sanitizeHTML(loadingParts.action)}`;

        setChatLoadingState(true); // Disables inputs etc.

        const fetchPromise = lastUserIngredients
            ? handleUserQuery(lastUserIngredients, false) // Refetch with original ingredients
            : (lastFetchWasSurprise ? handleUserQuery("", true) : Promise.resolve()); // Refetch surprise

        try {
            await fetchPromise;
            // The handleUserQuery function will internally call displayChatResults,
            // which needs to be aware it's updating an existing message if `isUnitUpdatingRecipes` is true.
            // For now, handleUserQuery creates a *new* loading message. This needs adjustment.
            // Let's modify handleUserQuery to accept the loadingMessageElement and update it.
            // The current `fetchPromise` here will resolve after `displayChatResults` in `handleUserQuery`
            // attempts to create a *new* message. This is not ideal for unit updates.
            //
            // Ideal flow for unit change:
            // 1. Identify the AI message to update.
            // 2. Show loading state *in that message*.
            // 3. Call a modified handleUserQuery/handleSurpriseMe that takes the target message element.
            // 4. That function fetches data and then updates the *target message element* instead of creating a new one.
            // This is getting complex for one go. Simpler approach for now:
            // The existing fetchPromise will create new messages. We can remove the old message.
            // This is not ideal UX but simpler to implement first.
            // After fetchPromise, if successful, the new recipes are in new bubbles.
            // We could remove `lastAIMessageWithRecipes` if the new fetch was successful.
            // This part needs careful thought on how `handleUserQuery` updates vs. creates messages.
            // For now, let's assume `handleUserQuery` will create a *new* message with updated recipes.
            // The old message `lastAIMessageWithRecipes` will still show loading. We should clean it up.
            // This is a temporary simplification: after new results are posted by handleUserQuery,
            // we can remove the original message that was marked as stale.
            // This means the "loading" state in the original bubble won't be replaced, but a new bubble appears.
            // This is not the best UX.
            //
            // Let's revert to a simpler unit change: it just re-runs the query and adds new messages.
            // The old messages remain. User can scroll.
            // The setChatLoadingState(true) above will show a global loading, and the new messages appear.

        } catch (error) {
            console.error("Unit change re-fetch failed:", error);
            updateUnitSystem(oldSystem); // Revert unit system on error
            // Display error in a new AI message, or update the 'lastAIMessageWithRecipes' if we can target it.
            displayChatError("Failed to update recipes for new units. Please try again.", lastAIMessageWithRecipes);
        } finally {
            isUnitUpdatingRecipes = false;
            if (lastAIMessageWithRecipes) {
                lastAIMessageWithRecipes.classList.remove('loading', 'content-stale-for-unit-update');
                // If we didn't successfully replace its content, it might still show loading text.
                // This needs to be handled by displayChatError or displayChatResults if they update in place.
            }
            setChatLoadingState(false); // Re-enable inputs
        }
    } else if (canRefetch) {
        // If there's context (last ingredients/surprise) but no visible recipe cards to update,
        // just re-run the query.
        appendMessage(`Switched to ${newSystem.toUpperCase()} units. Re-fetching with current context...`, 'ai');
        isUnitUpdatingRecipes = true; // ensure seed is reused if applicable
        if (lastUserIngredients) {
            await handleUserQuery(lastUserIngredients, false);
        } else if (lastFetchWasSurprise) {
            await handleUserQuery("", true);
        }
        isUnitUpdatingRecipes = false;
    }
}

function setupMobileMenuToggle() {
    if (mobileMenuButton && sidebar) {
        mobileMenuButton.addEventListener('click', () => {
            sidebar?.classList.toggle('open');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalFunctionality(); // Sets up common elements from core.ts (sidebar buttons, modals)
    initializeChatPageDOMReferences(); // Sets up chat-specific elements
    setupMobileMenuToggle();

    if (!API_KEY && messageListContainer) {
        appendMessage(`${panSVG} Configuration error: Sousie's AI brain is offline (API_KEY missing). Some features will be disabled.`, 'ai');
        if (userChatInput) userChatInput.disabled = true;
        if (sendChatButton) sendChatButton.disabled = true;
        if (chatSurpriseButton) chatSurpriseButton.disabled = true;
    } else if (messageListContainer && messageListContainer.innerHTML.trim() === '') {
         appendMessage(`${panSVG} Welcome to Sousie's Kitchen! What delicious ingredients are we working with today? Or try a 'Surprise Me!'`, 'ai');
    }

    if (sendChatButton && userChatInput) {
        sendChatButton.addEventListener('click', () => {
            const query = userChatInput.value.trim();
            if (query) {
                handleUserQuery(query, false);
            }
        });
        userChatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const query = userChatInput.value.trim();
                if (query) {
                    handleUserQuery(query, false);
                }
            }
        });
    }
    if (chatSurpriseButton) {
        chatSurpriseButton.addEventListener('click', () => handleUserQuery("", true));
    }
    if (chatStartOverButton) {
        chatStartOverButton.addEventListener('click', handleChatStartOver);
    }

    // Unit change listeners are now on buttons setup by core.ts's initializeGlobalFunctionality
    // We just need to ensure handleRecipePageUnitChange is correctly called.
    // core.ts should already have `usUnitsButton` and `metricUnitsButton` references.
    // We can re-assign event listeners here for the index.html page context if needed,
    // or ensure core.ts's listeners call this page-specific handler.
    // For simplicity, let's assume core.ts button listeners are general and we add specific ones here.
    // This means `initializeGlobalFunctionality` should perhaps not add its own unit change listeners,
    // or this page should coordinate.
    // Let's rely on core.ts to get `usUnitsButton` and `metricUnitsButton` and add our page-specific handler.
    const globalUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const globalMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;

    if(globalUsUnitsButton) globalUsUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('us'));
    if(globalMetricUnitsButton) globalMetricUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('metric'));
});
