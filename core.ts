/**
 * core.ts
 * Shared logic for the Sousie Single-Page Application.
 */

// --- Supabase Client (Globally available via CDN) ---
// @ts-ignore
const { createClient, User } = supabase;
export type SupabaseUser = InstanceType<typeof User>; // Export user type

// --- Global Configuration & State ---
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvazaobnepbwzommkakz.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52YXphb2JuZXBid3pvbW1rYWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTI4MDgsImV4cCI6MjA2OTQyODgwOH0.bQI03rskb1J6zNiSsTrvUap3XGZEOvQteQ7IOMtEfww';

export let supabaseClient: any;
export let currentUser: SupabaseUser | null = null;
export let currentUnitSystem: 'us' | 'metric' = 'us';

// --- DOM Element References (Common across pages) ---
// These will be populated by an init function called on each page
export let supabaseStatusIndicator: HTMLSpanElement | null;
export let authButton: HTMLButtonElement | null;
export let authButtonText: HTMLSpanElement | null;
export let userInfoDisplay: HTMLSpanElement | null;
export let loginModal: HTMLDivElement | null;
export let signupModal: HTMLDivElement | null;
export let loginForm: HTMLFormElement | null;
export let signupForm: HTMLFormElement | null;
export let loginEmailInput: HTMLInputElement | null;
export let loginPasswordInput: HTMLInputElement | null;
export let signupEmailInput: HTMLInputElement | null;
export let signupPasswordInput: HTMLInputElement | null;
export let loginMessage: HTMLDivElement | null;
export let signupMessage: HTMLDivElement | null;
export let loginSubmitButton: HTMLButtonElement | null;
export let signupSubmitButton: HTMLButtonElement | null;
export let goToSignupButton: HTMLButtonElement | null;
export let goToLoginButton: HTMLButtonElement | null;
export let usUnitsButton: HTMLButtonElement | null;
export let metricUnitsButton: HTMLButtonElement | null;
export let mainNav: HTMLElement | null;


// --- Type Definitions (Shared) ---
export interface Recipe {
  name: string;
  description?: string;
  anecdote?: string;
  chefTip?: string;
  ingredients: string[];
  instructions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  dietary_preferences?: string[];
  favorite_cuisines?: string[];
  cooking_skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  created_at: string;
  updated_at: string;
}

export interface UserIntent {
  intent_type: 'chat_message' | 'recipe_search' | 'recipe_like' | 'recipe_unlike' | 'menu_generate' | 'menu_save' | 'surprise_me' | 'ingredient_search' | 'dietary_filter' | 'cuisine_preference' | 'cooking_tip_request';
  intent_data: any;
  user_input?: string;
  ai_response?: string;
  success?: boolean;
  error_message?: string;
}
export interface DayMeal {
  dayName: string;
  mealName: string;
  recipe: Recipe;
}
export interface WeeklyMenu {
  weeklyMenu: DayMeal[];
}
export interface GroceryListCategory {
  category: string;
  items: string[];
}
export interface UserMenuSummary {
    id: string;
    menu_name: string;
}
export interface LikedRecipeFromDB {
    id: string;
    user_id: string;
    recipe_identifier: string;
    recipe_name: string;
    recipe_data: Recipe;
    liked_at: string;
}
export interface DynamicLoadingMessageParts {
    opener: string;
    svgIcon: string;
    mainMessage: string;
    action: string;
}

// --- Initialization Functions ---
export function initializeCoreDOMReferences() {
    supabaseStatusIndicator = document.getElementById('supabase-status-indicator') as HTMLSpanElement;
    authButton = document.getElementById('auth-button') as HTMLButtonElement;
    authButtonText = document.getElementById('auth-button-text') as HTMLSpanElement;
    userInfoDisplay = document.getElementById('user-info') as HTMLSpanElement;
    loginModal = document.getElementById('login-modal') as HTMLDivElement;
    signupModal = document.getElementById('signup-modal') as HTMLDivElement;
    loginForm = document.getElementById('login-form') as HTMLFormElement;
    signupForm = document.getElementById('signup-form') as HTMLFormElement;
    loginEmailInput = document.getElementById('login-email') as HTMLInputElement;
    loginPasswordInput = document.getElementById('login-password') as HTMLInputElement;
    signupEmailInput = document.getElementById('signup-email') as HTMLInputElement;
    signupPasswordInput = document.getElementById('signup-password') as HTMLInputElement;
    loginMessage = document.getElementById('login-message') as HTMLDivElement;
    signupMessage = document.getElementById('signup-message') as HTMLDivElement;
    loginSubmitButton = document.getElementById('login-submit-button') as HTMLButtonElement;
    signupSubmitButton = document.getElementById('signup-submit-button') as HTMLButtonElement;
    goToSignupButton = document.getElementById('go-to-signup') as HTMLButtonElement;
    goToLoginButton = document.getElementById('go-to-login') as HTMLButtonElement;
    usUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement;
    metricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement;
    mainNav = document.getElementById('main-nav') as HTMLElement;
}

export function initializeSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn("Supabase URL or Anon Key not detected. Database features will be unavailable.");
        if (supabaseStatusIndicator) {
            supabaseStatusIndicator.textContent = "DB Not Configured";
            supabaseStatusIndicator.className = 'status-warning';
        }
        if (authButton) authButton.disabled = true;
        // Disable other DB dependent buttons if needed here, e.g. save menu, favorites link
        const favoritesLink = document.getElementById('favorites-link') as HTMLAnchorElement | null;
        if (favoritesLink) {favoritesLink.style.pointerEvents = 'none'; favoritesLink.style.opacity = '0.6';}
        return false;
    }
    try {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized successfully.");
        if (supabaseStatusIndicator) {
            supabaseStatusIndicator.textContent = "DB Ready";
            supabaseStatusIndicator.className = 'status-success';
        }
        return true;
    } catch (e) {
        console.error("Error initializing Supabase client:", e);
        if (supabaseStatusIndicator) {
            supabaseStatusIndicator.textContent = "DB Error";
            supabaseStatusIndicator.className = 'status-error';
        }
        if (authButton) authButton.disabled = true;
        return false;
    }
}

// --- Auth Functions ---
export function updateAuthUI(user: SupabaseUser | null) {
    currentUser = user;
    const isLoggedIn = !!user;

    if (authButtonText) authButtonText.textContent = isLoggedIn ? 'Logout' : 'Login';
    if (userInfoDisplay) {
        userInfoDisplay.textContent = isLoggedIn ? `Hi, ${user?.email?.split('@')[0] || 'User'}!` : '';
        userInfoDisplay.title = isLoggedIn ? (user?.email || '') : '';
    }

    if (supabaseStatusIndicator) {
        if (isLoggedIn) {
            supabaseStatusIndicator.textContent = "DB Connected";
            supabaseStatusIndicator.className = 'status-success';
        } else if (supabaseClient) {
            supabaseStatusIndicator.textContent = "DB Ready";
            supabaseStatusIndicator.className = 'status-success';
        } else {
            supabaseStatusIndicator.textContent = "DB Not Configured";
            supabaseStatusIndicator.className = 'status-warning';
        }
    }
    // MPA specific: redirect or update UI based on auth state if necessary on page load
    // For example, if on favorites.html and user logs out, clear favorites display.
}

export async function handleLoginSubmit(event: Event) {
    event.preventDefault();
    if (!supabaseClient || !loginEmailInput || !loginPasswordInput || !loginSubmitButton || !loginMessage) return;

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    loginSubmitButton.disabled = true;
    if(loginMessage) clearModalMessage(loginMessage);

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            if(loginMessage) displayModalMessage(loginMessage, error.message, 'error');
            console.error('Login error:', error.message);
        } else if (data.user) {
            console.log('Login successful:', data.user);
            if(loginModal) closeModal(loginModal);
            // Auth state change will trigger UI update via listener
        } else {
             if(loginMessage) displayModalMessage(loginMessage, 'Login failed. Please try again.', 'error');
        }
    } catch (e: any) {
        if(loginMessage) displayModalMessage(loginMessage, 'An unexpected error occurred during login.', 'error');
        console.error('Unexpected login error:', e.message);
    } finally {
        loginSubmitButton.disabled = false;
    }
}

export async function handleSignupSubmit(event: Event) {
    event.preventDefault();
    if (!supabaseClient || !signupEmailInput || !signupPasswordInput || !signupSubmitButton || !signupMessage) return;

    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    signupSubmitButton.disabled = true;
    if(signupMessage) clearModalMessage(signupMessage);

    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        console.log('Supabase signup response data:', data);
        if (error) {
            console.error('Supabase signup error object:', error);
            if(signupMessage) displayModalMessage(signupMessage, error.message, 'error');
        } else if (data.session && data.user) {
            if(signupMessage) displayModalMessage(signupMessage, 'Signup successful! You are now logged in.', 'success');
            setTimeout(() => {
                if (signupModal && signupModal.classList.contains('is-open')) {
                    closeModal(signupModal);
                }
            }, 2000);
        } else if (data.user) {
            if(signupMessage) displayModalMessage(signupMessage, 'Signup successful! Please check your email to verify your account.', 'success');
        } else {
            if(signupMessage) displayModalMessage(signupMessage, 'Signup complete. Please check for a verification email or try logging in.', 'success');
        }
    } catch (e: any) {
        if(signupMessage) displayModalMessage(signupMessage, 'An unexpected error occurred during signup.', 'error');
        console.error('Unexpected signup error:', e);
    } finally {
        signupSubmitButton.disabled = false;
    }
}

export async function handleLogout() {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert(`Logout failed: ${error.message}`);
            console.error('Logout error:', error.message);
        } else {
            console.log('Logout successful');
            // Auth state change will trigger UI updates via listener
            // If on a page that requires auth (e.g., favorites), it might redirect or clear content.
            if (window.location.pathname.includes('favorites.html') || window.location.pathname.includes('menu.html')) {
                // Optionally redirect to home page after logout from protected pages
                // window.location.href = 'index.html';
            }
        }
    } catch (e: any) {
        alert(`An unexpected error occurred during logout: ${e.message}`);
        console.error('Unexpected logout error:', e.message);
    }
}

export async function checkInitialAuthState() {
    if (!supabaseClient) {
      updateAuthUI(null);
      if (authButton) authButton.disabled = true;
      const favoritesLink = document.getElementById('favorites-link') as HTMLAnchorElement | null;
      const menuPlannerLink = document.getElementById('menu-planner-link') as HTMLAnchorElement | null;
      if (favoritesLink) {favoritesLink.style.pointerEvents = 'none'; favoritesLink.style.opacity = '0.6';}
      // Menu planner saving/loading also depends on auth, so link can be disabled too if desired.
      return;
    }
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        updateAuthUI(session?.user ?? null);
    } catch (error) {
        console.error("Error getting initial session:", error);
        updateAuthUI(null);
    }

    supabaseClient.auth.onAuthStateChange((_event: string, session: any) => {
        updateAuthUI(session?.user ?? null);
        // Page-specific logic for auth changes will be in respective page scripts
    });
}


// --- Modal Management ---
export function displayModalMessage(modalMessageEl: HTMLDivElement, message: string, type: 'error' | 'success') {
    modalMessageEl.textContent = message;
    modalMessageEl.className = `modal-message ${type}`;
    modalMessageEl.style.display = 'block';
}

export function clearModalMessage(modalMessageEl: HTMLDivElement | null) {
    if (!modalMessageEl) return;
    modalMessageEl.textContent = '';
    modalMessageEl.className = 'modal-message';
    modalMessageEl.style.display = 'none';
}

export function openModal(modal: HTMLElement | null) {
    if (!modal) return;
    const messageEl = modal === loginModal ? loginMessage : signupMessage;
    if (messageEl) clearModalMessage(messageEl);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex'; // Show the modal
    const firstInput = modal.querySelector('input');
    firstInput?.focus();
}

export function closeModal(modal: HTMLElement | null) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none'; // Hide the modal
}

export function setupModalEventListeners() {
    if (!loginModal || !signupModal) return;
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if(loginModal) closeModal(loginModal);
            if(signupModal) closeModal(signupModal);
        });
    });
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', () => {
            if(loginModal) closeModal(loginModal);
            if(signupModal) closeModal(signupModal);
        });
    });
    if (goToSignupButton) goToSignupButton.addEventListener('click', () => { if(loginModal) closeModal(loginModal); if(signupModal) openModal(signupModal); });
    if (goToLoginButton) goToLoginButton.addEventListener('click', () => { if(signupModal) closeModal(signupModal); if(loginModal) openModal(loginModal); });
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);
}

// --- UI Utilities ---
export function sanitizeHTML(text: string): string {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

export const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#004499"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#0066CC"/></g></svg>`;

export function generateDynamicLoadingMessage(ingredientsText?: string): DynamicLoadingMessageParts {
     const openers = ["Alright!", "Ooh la la!", "Let's dive in!", "Excellent choice!", "Here we go!", "Fabulous!"];
    const actions = [
        "consulting my culinary cosmos for you!",
        "sifting through my best ideas!",
        "whipping up something special!",
        "diving deep into the flavor archives!",
        "searching for a masterpiece for you...",
        "checking my spice rack of inspiration!"
    ];
    const quotes = [
        { keyword: "salad", text: "A salad, you say? 'To make a good salad is to be a brilliant diplomatist – the problem is entirely one of knowing how much oil one must put with one’s vinegar.' - Oscar Wilde. Let's get you some brilliant options!" },
        { keyword: "chicken", text: "Chicken! The versatile champion of the kitchen! 'Cooking is like painting or writing a song. Just as there are only so many notes or colors, there are only so many flavors - it's how you combine them that sets you apart.' - Wolfgang Puck." },
        { keyword: "pasta", text: "Pasta! 'Life is a combination of magic and pasta.' - Federico Fellini. I'm conjuring some magic for your plate!" },
        { keyword: "surprise", text: "A surprise! My favorite! Let's see..."}
    ];
    const generalThoughts = [
        "'Cooking is at once child's play and adult joy.' - Craig Claiborne.",
        "'No one is born a great cook, one learns by doing.' - Julia Child.",
        "The kitchen is my happy place, let's make it yours too!",
    ];
    let chosenQuote = generalThoughts[Math.floor(Math.random() * generalThoughts.length)]; // Default
    if (ingredientsText) {
        const lowerIngredients = ingredientsText.toLowerCase();
        if (lowerIngredients === "a delightful surprise" || lowerIngredients === "units") {
            const surpriseQuote = quotes.find(q => q.keyword === "surprise");
            if (surpriseQuote) chosenQuote = surpriseQuote.text;
        } else {
            for (const q of quotes) {
                if (lowerIngredients.includes(q.keyword)) {
                    chosenQuote = q.text;
                    break;
                }
            }
        }
    }
    return {
        opener: openers[Math.floor(Math.random() * openers.length)],
        svgIcon: panSVG, // Use the global panSVG
        mainMessage: chosenQuote,
        action: `Now, Sousie is ${actions[Math.floor(Math.random() * actions.length)]}`
    };
}

// --- Recipe Card Generation --- (Used by index.tsx and favorites.tsx)
export function _generateRecipeComponentHTML(recipe: Recipe, componentType: 'Main Dish' | 'Side Dish' | 'Dessert', unitSystem: 'us' | 'metric'): string {
    // ... (Implementation from original index.tsx, ensure sanitizeHTML is used)
    if (!recipe || !recipe.name) {
        const typeName = componentType.toLowerCase();
        if (componentType === 'Side Dish') {
            return `<div class="recipe-component"><h4 class="recipe-component-title">${sanitizeHTML(componentType)}</h4><p>Sousie didn't suggest a specific side for this meal.</p></div>`;
        }
         if (componentType === 'Dessert') {
            return `<div class="recipe-component"><h4 class="recipe-component-title">${sanitizeHTML(componentType)}</h4><p>Sousie didn't suggest a specific dessert for this meal pairing.</p></div>`;
        }
        return `<div class="recipe-component"><h4 class="recipe-component-title">${sanitizeHTML(componentType)}</h4><p>Sousie's still working on the details for this ${sanitizeHTML(typeName)}!</p></div>`;
    }

    const ingredientsList = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
        ? recipe.ingredients.map((ing: string) => `<li>${sanitizeHTML(ing)}</li>`).join('')
        : `<li>Sousie says: Ingredients not specified for this ${sanitizeHTML(componentType.toLowerCase())}!</li>`;

    const instructionsList = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? recipe.instructions.map((instr: string) => `<li>${sanitizeHTML(instr)}</li>`).join('')
        : (recipe.instructions && typeof recipe.instructions === 'string'
            ? `<p>${sanitizeHTML(recipe.instructions).replace(/\n/g, '<br>')}</p>`
            : `<li>Sousie says: Instructions seem to be missing for this ${sanitizeHTML(componentType.toLowerCase())}!</li>`);

    const instructionsHtml = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? `<ol>${instructionsList}</ol>`
        : instructionsList;

    let componentHTML = `<div class="recipe-component">`;
    componentHTML += `<h4 class="recipe-component-title">${sanitizeHTML(componentType)}: ${sanitizeHTML(recipe.name)}</h4>`;

    if (componentType === 'Main Dish' && (recipe.anecdote || recipe.chefTip)) {
        componentHTML += `<div class="sousie-extra-info component-extra-info">`;
        if (recipe.anecdote) {
            componentHTML += `<p class="anecdote-text"><em>"${sanitizeHTML(recipe.anecdote)}"</em></p>`;
        }
        if (recipe.chefTip) {
            componentHTML += `<p class="chef-tip-text"><strong>Chef's Tip:</strong> ${sanitizeHTML(recipe.chefTip)}</p>`;
        }
        componentHTML += `</div>`;
    }

    componentHTML += `<h5>Ingredients (${unitSystem === 'us' ? 'US Customary' : 'Metric'}):</h5>
                      <ul>${ingredientsList}</ul>
                      <h5>Instructions:</h5>
                      ${instructionsHtml}
                    </div>`;
    return componentHTML;
}

export function createExpandableRecipeCard(
    mealPairing: { mealTitle?: string; mainRecipe: Recipe; sideRecipe?: Recipe },
    cardIdPrefix: string | number,
    isFavoriteCard: boolean = false,
    pageSpecificUnlikeCallback?: (recipeIdentifier: string, cardElement: HTMLElement) => void // For favorites page to remove card
): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'recipe-card expandable';
    const overallName = mealPairing.mealTitle || mealPairing.mainRecipe?.name || 'Unnamed Meal';
    const mainRecipeData = mealPairing.mainRecipe || ({} as Recipe);
    const recipeIdentifier = (mainRecipeData.name || `unknown-recipe-${Date.now()}`).replace(/\s+/g, '-').toLowerCase();

    const cardUniqueIdPart = `${cardIdPrefix}-${recipeIdentifier.replace(/[^a-zA-Z0-9-]/g, '')}`;
    card.setAttribute('data-recipe-id', cardUniqueIdPart);
    card.setAttribute('data-recipe-name', overallName);
    card.setAttribute('data-recipe-identifier', recipeIdentifier);

    const likeButton = document.createElement('button');
    likeButton.className = 'like-button';
    likeButton.setAttribute('aria-label', `Like ${overallName}`);
    likeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"/></svg>`;

    if (isFavoriteCard) {
        likeButton.classList.add('liked');
        likeButton.setAttribute('aria-pressed', 'true');
    }

    likeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentRecipeIdentifier = card.getAttribute('data-recipe-identifier');
        const currentRecipeName = card.getAttribute('data-recipe-name');

        if (!currentRecipeIdentifier || !currentRecipeName) {
            console.error("Recipe identifier or name missing from card data.");
            return;
        }
        if (!currentUser) {
            alert("Please log in to save your favorite recipes!");
            if(loginModal) openModal(loginModal);
            return;
        }
        const isNowLiked = likeButton.classList.toggle('liked');
        likeButton.setAttribute('aria-pressed', String(isNowLiked));

        if (isNowLiked) {
            handleLikeRecipe(currentRecipeIdentifier, currentRecipeName, mainRecipeData);
        } else {
            if (pageSpecificUnlikeCallback) { // Used on favorites page
                pageSpecificUnlikeCallback(currentRecipeIdentifier, card);
            } else { // Used on recipe suggestion page
                handleUnlikeRecipe(currentRecipeIdentifier);
            }
        }
    });

    const summary = document.createElement('div');
    summary.className = 'recipe-summary';
    let summaryHTML = `<h3>${sanitizeHTML(overallName)}</h3>
                       <p>${sanitizeHTML(mainRecipeData.description || 'Sousie is preparing a delightful description for this meal!')}</p>`;
    if (mainRecipeData.anecdote || mainRecipeData.chefTip) {
        summaryHTML += `<div class="sousie-extra-info">
                        <h4><svg class="extra-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 2s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Sousie's Story & Tips</h4>`;
        if (mainRecipeData.anecdote) summaryHTML += `<p class="anecdote-text"><em>"${sanitizeHTML(mainRecipeData.anecdote)}"</em></p>`;
        if (mainRecipeData.chefTip) summaryHTML += `<p class="chef-tip-text"><strong>Chef's Tip:</strong> ${sanitizeHTML(mainRecipeData.chefTip)}</p>`;
        summaryHTML += `</div>`;
    }
    summaryHTML += `<button class="expand-toggle" aria-expanded="false" aria-controls="details-${cardUniqueIdPart}">
                        <span class="toggle-text">Show Meal Details</span>
                        <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
                    </button>`;
    summary.innerHTML = summaryHTML;

    const details = document.createElement('div');
    details.className = 'recipe-details';
    details.id = `details-${cardUniqueIdPart}`;
    details.style.display = 'none';
    let detailsHTML = mealPairing.mainRecipe ? _generateRecipeComponentHTML(mealPairing.mainRecipe, "Main Dish", currentUnitSystem) : "";
    if (!isFavoriteCard && mealPairing.sideRecipe && mealPairing.sideRecipe.name) {
        const sideRecipeNameLower = mealPairing.sideRecipe.name.toLowerCase();
        const sideRecipeDescLower = mealPairing.sideRecipe.description?.toLowerCase() || "";
        const isDessert = sideRecipeNameLower.includes("dessert") || sideRecipeDescLower.includes("dessert"); // Simplified check
        detailsHTML += _generateRecipeComponentHTML(mealPairing.sideRecipe, isDessert ? "Dessert" : "Side Dish", currentUnitSystem);
    } else if (!isFavoriteCard) {
        detailsHTML += `<div class="recipe-component"><h4 class="recipe-component-title">Side Dish / Dessert</h4><p>No specific side dish or dessert paired with this recipe.</p></div>`;
    }
    details.innerHTML = detailsHTML;

    card.appendChild(likeButton);
    card.appendChild(summary);
    card.appendChild(details);

    const toggleButton = summary.querySelector('.expand-toggle') as HTMLButtonElement;
    toggleButton.addEventListener('click', () => {
        const isExpanded = card.classList.toggle('expanded');
        details.style.display = isExpanded ? 'block' : 'none';
        toggleButton.setAttribute('aria-expanded', String(isExpanded));
        const toggleText = toggleButton.querySelector('.toggle-text') as HTMLSpanElement;
        if (toggleText) toggleText.textContent = isExpanded ? 'Hide Meal Details' : 'Show Meal Details';
        const toggleIcon = toggleButton.querySelector('.toggle-icon') as SVGSVGElement;
        if (toggleIcon) toggleIcon.innerHTML = isExpanded ? '<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/><path d="M0 0h24v24H0z" fill="none"/>' : '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/>';
    });
    return card;
}

// --- Like/Unlike Functions ---
export async function handleLikeRecipe(recipeIdentifier: string, recipeName: string, recipeData: Recipe | null) {
    if (!currentUser || !supabaseClient) {
        console.warn("User not logged in or Supabase client not available.");
        return;
    }
    if (!recipeData || !recipeData.name) {
        console.error("No recipe data or recipe name provided to save for like.");
        alert("Could not save like: recipe details are missing or invalid.");
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('user_liked_recipes')
            .upsert({
                user_id: currentUser.id,
                recipe_identifier: recipeIdentifier,
                recipe_name: recipeName,
                recipe_data: recipeData,
                source: 'sousie_generated'
            }, { onConflict: 'user_id, recipe_identifier' });
        if (error) throw error;
        console.log(`Recipe "${recipeName}" liked and saved.`);
        
        // Track user intent
        await trackUserIntent({
            intent_type: 'recipe_like',
            intent_data: { recipe_identifier: recipeIdentifier, recipe_name: recipeName },
            success: true
        });
    } catch (error: any) {
        console.error("Error saving like to Supabase:", error.message);
        alert("Oh dear! Sousie couldn't save your like right now.");
        
        // Track failed intent
        await trackUserIntent({
            intent_type: 'recipe_like',
            intent_data: { recipe_identifier: recipeIdentifier, recipe_name: recipeName },
            success: false,
            error_message: error.message
        });
    }
}

export async function handleUnlikeRecipe(recipeIdentifier: string) {
    if (!currentUser || !supabaseClient) {
        console.warn("User not logged in or Supabase client not available.");
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('user_liked_recipes')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('recipe_identifier', recipeIdentifier);
        if (error) throw error;
        console.log(`Recipe ID "${recipeIdentifier}" unliked.`);
        
        // Track user intent
        await trackUserIntent({
            intent_type: 'recipe_unlike',
            intent_data: { recipe_identifier: recipeIdentifier },
            success: true
        });
    } catch (error: any) {
        console.error("Error removing like from Supabase:", error.message);
        alert("Oh crumbs! Sousie couldn't remove your like.");
        
        // Track failed intent
        await trackUserIntent({
            intent_type: 'recipe_unlike',
            intent_data: { recipe_identifier: recipeIdentifier },
            success: false,
            error_message: error.message
        });
    }
}

// --- Unit System ---
export function updateUnitSystem(newSystem: 'us' | 'metric') {
    console.log('🔧 DEBUG: updateUnitSystem called with:', newSystem);
    currentUnitSystem = newSystem;
    console.log('🔧 DEBUG: Unit buttons available:', { usUnitsButton: !!usUnitsButton, metricUnitsButton: !!metricUnitsButton });
    
    if(usUnitsButton) {
        usUnitsButton.classList.toggle('active', newSystem === 'us');
        usUnitsButton.setAttribute('aria-pressed', String(newSystem === 'us'));
        console.log('🔧 DEBUG: US button updated, active:', newSystem === 'us');
    }
    if(metricUnitsButton) {
        metricUnitsButton.classList.toggle('active', newSystem === 'metric');
        metricUnitsButton.setAttribute('aria-pressed', String(newSystem === 'metric'));
        console.log('🔧 DEBUG: Metric button updated, active:', newSystem === 'metric');
    }
    // Page-specific scripts will handle re-rendering content if needed
}

// --- Header Active Link ---
export function updateHeaderActiveLinks() {
    if (!mainNav) return;
    const currentPath = window.location.pathname;
    const navLinks = mainNav.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const anchor = link as HTMLAnchorElement;
        // Check if the link's href (e.g., "menu.html") is part of the current path
        if (anchor.pathname === currentPath || (currentPath === '/' && anchor.pathname === '/index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- Intent Tracking Functions ---
export async function trackUserIntent(intent: UserIntent) {
    if (!supabaseClient) return;
    
    const sessionId = getOrCreateSessionId();
    
    try {
        const { error } = await supabaseClient
            .from('user_intents')
            .insert({
                user_id: currentUser?.id || null,
                session_id: sessionId,
                intent_type: intent.intent_type,
                intent_data: intent.intent_data,
                user_input: intent.user_input,
                ai_response: intent.ai_response,
                success: intent.success ?? true,
                error_message: intent.error_message
            });
        
        if (error) {
            console.warn('Failed to track user intent:', error.message);
        }
    } catch (error) {
        console.warn('Error tracking user intent:', error);
    }
}

function getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('sousie_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('sousie_session_id', sessionId);
    }
    return sessionId;
}

// --- User Profile Functions ---
export async function createUserProfile(userData: Partial<UserProfile>) {
    if (!currentUser || !supabaseClient) return null;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .upsert({
                id: currentUser.id,
                email: currentUser.email,
                ...userData
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error: any) {
        console.error('Error creating user profile:', error.message);
        return null;
    }
}

export async function getUserProfile(): Promise<UserProfile | null> {
    if (!currentUser || !supabaseClient) return null;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error: any) {
        console.error('Error fetching user profile:', error.message);
        return null;
    }
}

// --- Global Initializers to be called by each page script ---
export function initializeGlobalFunctionality() {
    initializeCoreDOMReferences();
    const supabaseReady = initializeSupabaseClient();
    setupModalEventListeners(); // Modals are common
    checkInitialAuthState(); // Auth state is common
    updateHeaderActiveLinks(); // Set active link based on current page

    if (authButton) {
        authButton.addEventListener('click', () => {
            if (!supabaseClient) {
                alert("Database connection is not configured. Login is unavailable.");
                return;
            }
            if (currentUser) {
                handleLogout();
            } else {
                if (loginModal) openModal(loginModal);
            }
        });
    }

    if(usUnitsButton && metricUnitsButton) {
        // Initial state based on currentUnitSystem
        usUnitsButton.classList.toggle('active', currentUnitSystem === 'us');
        usUnitsButton.setAttribute('aria-pressed', String(currentUnitSystem === 'us'));
        metricUnitsButton.classList.toggle('active', currentUnitSystem === 'metric');
        metricUnitsButton.setAttribute('aria-pressed', String(currentUnitSystem === 'metric'));
        // Event listeners will be set up by specific page scripts if they need to react to unit changes
    }

    // Note: OpenAI API key is now handled in the main app file
    
    // Initialize user profile if user is logged in
    if (currentUser && supabaseReady) {
        initializeUserProfile();
    }
    
    if (!supabaseReady) { // If Supabase client failed to initialize
        const favoritesLink = document.getElementById('favorites-link') as HTMLAnchorElement | null;
        const menuLink = document.getElementById('menu-planner-link') as HTMLAnchorElement | null;
        if (favoritesLink) { favoritesLink.style.pointerEvents = 'none'; favoritesLink.style.opacity = '0.6'; }
        if (menuLink && menuLink.style.pointerEvents !== 'none') { // If not already disabled by API_KEY check
            // Menu planner uses Supabase for saving/loading
             // menuLink.style.pointerEvents = 'none'; menuLink.style.opacity = '0.6';
        }
    }
}

// --- User Profile Initialization ---
async function initializeUserProfile() {
    if (!currentUser || !supabaseClient) return;
    
    try {
        // Check if user profile exists, create if not
        const { data: existingProfile } = await supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();
        
        if (!existingProfile) {
            await createUserProfile({
                email: currentUser.email,
                full_name: currentUser.user_metadata?.full_name || null
            });
        }
    } catch (error: any) {
        console.error('Error initializing user profile:', error.message);
    }
}
