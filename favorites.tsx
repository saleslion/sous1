/**
 * favorites.tsx - Script for favorites.html (My Favorites)
 */
import {
    currentUser, currentUnitSystem, supabaseClient,
    initializeGlobalFunctionality,
    sanitizeHTML, createExpandableRecipeCard, panSVG,
    updateUnitSystem, handleUnlikeRecipe,
    LikedRecipeFromDB, Recipe
} from "./core";

// DOM Elements specific to this page
let favoritesViewContent: HTMLDivElement | null;
let favoriteRecipesDisplay: HTMLDivElement | null;
let favoritesMessages: HTMLDivElement | null;

// Page specific state
let isFavoritesLoadingState = false;
let isFavoritesUnitUpdating: boolean = false;


function initializeFavoritesPageDOMReferences() {
    favoritesViewContent = document.getElementById('favorites-view-content') as HTMLDivElement;
    favoriteRecipesDisplay = document.getElementById('favorite-recipes-display') as HTMLDivElement;
    favoritesMessages = document.getElementById('favorites-messages') as HTMLDivElement;
}

function setFavoritesPageLoading(isLoading: boolean, message?: string) {
    isFavoritesLoadingState = isLoading;
    // Disable common header buttons during loading
    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if (coreUsUnitsButton) coreUsUnitsButton.disabled = isLoading || isFavoritesUnitUpdating;
    if (coreMetricUnitsButton) coreMetricUnitsButton.disabled = isLoading || isFavoritesUnitUpdating;

    if (favoritesMessages) {
        if (isLoading) {
            favoritesMessages.innerHTML = `<div class="message loading-message">${panSVG} ${sanitizeHTML(message || 'Fetching your favorites...')}</div>`;
            favoritesMessages.style.display = 'block';
        } else {
            const loadingMsgEl = favoritesMessages.querySelector('.loading-message');
            if (loadingMsgEl) {
                favoritesMessages.innerHTML = '';
                favoritesMessages.style.display = 'none';
            }
        }
    }
}

function displayFavoritesPageMessage(message: string, type: 'info' | 'error' = 'info') {
    if (!favoritesMessages) return;
    favoritesMessages.innerHTML = `<div class="message ${type}-message">${panSVG} ${sanitizeHTML(message)}</div>`;
    favoritesMessages.style.display = 'block';
    if (favoriteRecipesDisplay) favoriteRecipesDisplay.innerHTML = ''; // Clear display area
}

async function displayUserFavoritesOnPage() {
    if (!favoriteRecipesDisplay) return;
    if (!currentUser || !supabaseClient) {
        displayFavoritesPageMessage("Please log in to see your favorite recipes.", "info");
        return;
    }

    setFavoritesPageLoading(true, "Fetching your favorite recipes...");
    favoriteRecipesDisplay.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('user_liked_recipes')
            .select('recipe_identifier, recipe_name, recipe_data, liked_at')
            .eq('user_id', currentUser.id)
            .order('liked_at', { ascending: false });

        if (error) {
            if (error.message.includes("Failed to fetch")) throw new Error("Network error: Could not load favorites.");
            throw error;
        }

        if (data && data.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'recipes-grid'; // Reuse recipe grid styling
            data.forEach((likedRecipe: LikedRecipeFromDB, index: number) => {
                if (likedRecipe.recipe_data && typeof likedRecipe.recipe_data === 'object' && likedRecipe.recipe_data.name) {
                    const mealPairingFromFavorite = {
                        mealTitle: likedRecipe.recipe_name || likedRecipe.recipe_data.name,
                        mainRecipe: likedRecipe.recipe_data,
                        // Favorites don't store separate side recipes, so it's undefined here
                    };
                    // Pass a callback to handle unliking directly from the favorites page
                    const card = createExpandableRecipeCard(
                        mealPairingFromFavorite,
                        `favorite-${index}`,
                        true, // isFavoriteCard = true
                        (recipeIdentifier, cardElement) => { // pageSpecificUnlikeCallback
                            handleUnlikeRecipe(recipeIdentifier); // Call core unlike
                            if (cardElement.parentNode) {
                                cardElement.parentNode.removeChild(cardElement);
                                if (favoriteRecipesDisplay && (!favoriteRecipesDisplay.hasChildNodes() || favoriteRecipesDisplay.children.length === 0)) {
                                    displayFavoritesPageMessage("No more favorites here! Go find some new ones!", "info");
                                }
                            }
                        }
                    );
                    grid.appendChild(card);
                } else {
                    console.warn("Skipping favorite with missing or invalid recipe_data:", likedRecipe);
                }
            });
            if (grid.children.length > 0) {
                favoriteRecipesDisplay.appendChild(grid);
                 if (favoritesMessages && favoritesMessages.querySelector('.loading-message')) {
                    favoritesMessages.innerHTML = ''; // Clear loading message
                    favoritesMessages.style.display = 'none';
                }
            } else {
                 displayFavoritesPageMessage("You haven't liked any recipes yet!", "info");
            }
        } else {
            displayFavoritesPageMessage("You haven't liked any recipes yet. Go explore and find some favorites!", "info");
        }
    } catch (err: any) {
        console.error("Error fetching favorite recipes:", err.message);
        displayFavoritesPageMessage(err.message, "error");
    } finally {
        setFavoritesPageLoading(false);
    }
}

async function handleFavoritesPageUnitChange(newSystem: 'us' | 'metric') {
    if (isFavoritesLoadingState || currentUnitSystem === newSystem) return;
    // const oldSystem = currentUnitSystem; // Keep for potential revert on error
    updateUnitSystem(newSystem);

    if (currentUser && supabaseClient && favoritesViewContent && favoriteRecipesDisplay && favoriteRecipesDisplay.querySelector('.recipe-card')) {
        isFavoritesUnitUpdating = true;
        const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
        const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
        if(coreUsUnitsButton) coreUsUnitsButton.disabled = true;
        if(coreMetricUnitsButton) coreMetricUnitsButton.disabled = true;

        favoritesViewContent.classList.add('content-stale-for-unit-update');
        // No need to show a special message for unit updating if displayUserFavoritesOnPage handles its own loading message
        // setFavoritesPageLoading(true, "Updating units for your favorites...");
        await displayUserFavoritesOnPage(); // Re-fetch and display favorites with new units
        
        // Short delay to ensure UI updates visually, can be adjusted or removed
        await new Promise(resolve => setTimeout(resolve, 100)); 
        
        favoritesViewContent.classList.remove('content-stale-for-unit-update');
        isFavoritesUnitUpdating = false; // Ensure this is reset before setFavoritesPageLoading(false)
        setFavoritesPageLoading(false); // displayUserFavoritesOnPage will also call this, ensure it's handled correctly.
                                        // The one in displayUserFavoritesOnPage should be enough.
        if(coreUsUnitsButton) coreUsUnitsButton.disabled = isFavoritesLoadingState; // isFavoritesLoadingState should be false now
        if(coreMetricUnitsButton) coreMetricUnitsButton.disabled = isFavoritesLoadingState;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalFunctionality();
    initializeFavoritesPageDOMReferences();

    if (!supabaseClient) {
        displayFavoritesPageMessage("Database features are unavailable. Cannot load favorites.", "error");
    } else if (!currentUser) {
        displayFavoritesPageMessage("Please log in to see your favorite recipes.", "info");
    } else {
        displayUserFavoritesOnPage();
    }

    const coreUsUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement | null;
    const coreMetricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement | null;
    if(coreUsUnitsButton) coreUsUnitsButton.addEventListener('click', () => handleFavoritesPageUnitChange('us'));
    if(coreMetricUnitsButton) coreMetricUnitsButton.addEventListener('click', () => handleFavoritesPageUnitChange('metric'));

    // Listener for auth changes to update favorites page UI
     if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((_event: string, session: any) => {
            // currentUser is updated by core's onAuthStateChange
            const user = session?.user ?? null;
            if (user) {
                // User logged in or session restored
                // Check if the favorites display is empty or shows a login message
                const isDisplayEmptyOrShowingLoginMsg = !favoriteRecipesDisplay?.hasChildNodes() || 
                                                       (favoritesMessages && favoritesMessages.textContent?.includes("Please log in"));
                
                if(isDisplayEmptyOrShowingLoginMsg && !isFavoritesLoadingState) {
                    displayUserFavoritesOnPage();
                }
            } else { // Logged out
                if(favoriteRecipesDisplay) favoriteRecipesDisplay.innerHTML = '';
                displayFavoritesPageMessage("Please log in to see your favorite recipes.", "info");
            }
        });
    }
});
