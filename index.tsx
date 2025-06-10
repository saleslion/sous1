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

// DOM Elements specific to this page
let resultsContainer: HTMLDivElement | null;
let ingredientsInput: HTMLInputElement | null;
let dietaryInput: HTMLInputElement | null;
let suggestButton: HTMLButtonElement | null;
let surpriseButton: HTMLButtonElement | null;
let startOverButton: HTMLButtonElement | null;

// Page specific state
let isLoadingRecipes = false;
let lastUserIngredients: string | null = null;
let lastUserDietary: string | null = null;
let lastFetchWasSurprise: boolean = false;
let isUnitUpdatingRecipes: boolean = false;
let lastSuccessfulFetchSeed: number | null = null;

// Define system instruction locally for this page
const SOUSIE_SYSTEM_INSTRUCTION = "You are Sousie, a friendly and creative AI chef. Provide recipes and meal ideas. Be encouraging and slightly whimsical. Ensure all recipes are complete and make sense. Your primary goal is to inspire users in the kitchen with delightful and practical suggestions.";


function initializeRecipePageDOMReferences() {
    resultsContainer = document.getElementById('results-container') as HTMLDivElement;
    ingredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
    dietaryInput = document.getElementById('dietary-input') as HTMLInputElement;
    suggestButton = document.getElementById('suggest-button') as HTMLButtonElement;
    surpriseButton = document.getElementById('surprise-button') as HTMLButtonElement;
    startOverButton = document.getElementById('start-over-button') as HTMLButtonElement;
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

async function handleSuggestRecipes(ingredientsQuery?: string) {
    if (!ai || !API_KEY || isLoadingRecipes || !ingredientsInput || !dietaryInput) return;
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

    let jsonStrToParse = "";
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
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall;
        displayResults(data, 'recipes');
    } catch (error: any) {
        console.error("Error suggesting recipes:", error, "\nMalformed JSON:", jsonStrToParse);
        displayRecipeError("Oh no! Sousie had trouble fetching recipes. Check ingredients or try again.");
    } finally {
        setRecipeSuggestionsLoading(false);
    }
}

async function handleSurpriseMe() {
    if (!ai || !API_KEY || isLoadingRecipes || !dietaryInput) return;
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

    let jsonStrToParse = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: promptUserMessage,
            config: { responseMimeType: "application/json", systemInstruction: SOUSIE_SYSTEM_INSTRUCTION, thinkingConfig: { thinkingBudget: 0 }, seed: seedForCurrentApiCall },
        });
        let rawText = (typeof response.text === 'string') ? response.text.trim() : "";
        const match = rawText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawText;
        if (!jsonStrToParse) throw new Error("Empty AI response for surprise.");
        const data = JSON.parse(jsonStrToParse);
        if (!isUnitUpdatingRecipes) lastSuccessfulFetchSeed = seedForCurrentApiCall;
        displayResults(data, 'surprise');
    } catch (error) {
        console.error("Error fetching surprise:", error, "\nMalformed JSON:", jsonStrToParse);
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


document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalFunctionality(); // Sets up common elements, auth, modals
    initializeRecipePageDOMReferences(); // Sets up elements specific to this page

    if (!API_KEY && resultsContainer) {
        resultsContainer.innerHTML = `<div class="message error-message">${panSVG} Configuration error: Sousie's AI brain is offline (API_KEY missing). Some features will be disabled.</div>`;
        // Disable AI specific buttons on this page
        if (suggestButton) suggestButton.disabled = true;
        if (surpriseButton) surpriseButton.disabled = true;
    } else if (resultsContainer && resultsContainer.innerHTML.trim() === '') {
         resultsContainer.innerHTML = `<div class="message info-message">${panSVG}Welcome to Sousie's Kitchen! What delicious ingredients are we working with today? Or try a 'Surprise Me!'</div>`;
    }


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

    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if(coreUsUnitsButton) coreUsUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('us'));
    if(coreMetricUnitsButton) coreMetricUnitsButton.addEventListener('click', () => handleRecipePageUnitChange('metric'));

});
