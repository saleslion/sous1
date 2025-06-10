
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
// Supabase Client (Note: supabase-js v2 is globally available via CDN script in index.html)
// @ts-ignore Supabase is loaded globally from CDN
const { createClient, User } = supabase;

const API_KEY = process.env.API_KEY;

// --- Supabase Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovnwftdzmuchbnmpmfev.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92bndmdGR6bXVjaGJubXBtZmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NzAwODIsImV4cCI6MjA2NTA0NjA4Mn0.fGImUiJMLAHKFrnDVgw7X0nGOw3Dmm-xeAdb-GeVWJc';

let supabaseClient: any; // Using 'any' for simplicity with CDN-loaded library
let currentUser: InstanceType<typeof User> | null = null; // To store the current user

const supabaseStatusIndicator = document.getElementById('supabase-status-indicator') as HTMLSpanElement;
const authButton = document.getElementById('auth-button') as HTMLButtonElement;
const authButtonText = document.getElementById('auth-button-text') as HTMLSpanElement;
const userInfoDisplay = document.getElementById('user-info') as HTMLSpanElement;

// Modal elements
const loginModal = document.getElementById('login-modal') as HTMLDivElement;
const signupModal = document.getElementById('signup-modal') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const signupForm = document.getElementById('signup-form') as HTMLFormElement;
const loginEmailInput = document.getElementById('login-email') as HTMLInputElement;
const loginPasswordInput = document.getElementById('login-password') as HTMLInputElement;
const signupEmailInput = document.getElementById('signup-email') as HTMLInputElement;
const signupPasswordInput = document.getElementById('signup-password') as HTMLInputElement;
const loginMessage = document.getElementById('login-message') as HTMLDivElement;
const signupMessage = document.getElementById('signup-message') as HTMLDivElement;
const loginSubmitButton = document.getElementById('login-submit-button') as HTMLButtonElement;
const signupSubmitButton = document.getElementById('signup-submit-button') as HTMLButtonElement;
const goToSignupButton = document.getElementById('go-to-signup') as HTMLButtonElement;
const goToLoginButton = document.getElementById('go-to-login') as HTMLButtonElement;

// View Elements
const recipeSuggestionsView = document.getElementById('results-container') as HTMLDivElement;
const menuPlannerView = document.getElementById('menu-planner-view') as HTMLDivElement;
const favoritesView = document.getElementById('favorites-view') as HTMLDivElement;


// Header Control Buttons for Views
const menuPlannerButton = document.getElementById('menu-planner-button') as HTMLButtonElement;
const favoritesButton = document.getElementById('favorites-button') as HTMLButtonElement;


// Menu Planner Specific Elements
const menuPlannerControls = document.getElementById('menu-planner-controls') as HTMLDivElement;
const generateWeeklyMenuButton = document.getElementById('generate-weekly-menu-button') as HTMLButtonElement;
const saveCurrentMenuButton = document.getElementById('save-current-menu-button') as HTMLButtonElement;
const savedMenusDropdown = document.getElementById('saved-menus-dropdown') as HTMLSelectElement;
const weeklyMenuDisplay = document.getElementById('weekly-menu-display') as HTMLDivElement;
const groceryListDisplay = document.getElementById('grocery-list-display') as HTMLDivElement;
const menuPlannerMessages = document.getElementById('menu-planner-messages') as HTMLDivElement;
const backToRecipesButton = document.getElementById('back-to-recipes-button') as HTMLButtonElement;

// Favorites Specific Elements
const favoritesHeaderControls = document.getElementById('favorites-header-controls') as HTMLDivElement; // Added in HTML
const favoritesMessages = document.getElementById('favorites-messages') as HTMLDivElement; // Added in HTML
const favoriteRecipesDisplay = document.getElementById('favorite-recipes-display') as HTMLDivElement; // Added in HTML
const backToRecipesFromFavoritesButton = document.getElementById('back-to-recipes-from-favorites-button') as HTMLButtonElement;

// Footer Element
const footerElement = document.querySelector('footer') as HTMLElement;


// State for Menu Planner
let currentViewMode: 'recipes' | 'menuPlanner' | 'favorites' = 'recipes'; // Added 'favorites'
interface Recipe {
  name: string;
  description?: string;
  anecdote?: string;
  chefTip?: string;
  ingredients: string[];
  instructions: string[];
}
interface DayMeal {
  dayName: string;
  mealName: string;
  recipe: Recipe;
}
interface WeeklyMenu {
  weeklyMenu: DayMeal[];
}
interface GroceryListItem {
  item: string;
  quantity?: string; // Optional: if AI can consolidate
  unit?: string;     // Optional: if AI can consolidate
}
interface GroceryListCategory {
  category: string;
  items: string[]; // For simplicity, keep as array of strings like "2 cups flour"
}
interface UserMenuSummary {
    id: string;
    menu_name: string;
}
interface LikedRecipeFromDB {
    id: string;
    user_id: string;
    recipe_identifier: string;
    recipe_name: string;
    recipe_data: Recipe; // Assuming this structure for recipe_data
    liked_at: string;
}


let currentWeeklyMenuData: WeeklyMenu | null = null;
let currentGroceryListData: { groceryList: GroceryListCategory[] } | null = null;
let currentSavedUserMenus: UserMenuSummary[] = [];
let isMenuPlannerLoading = false;
let isFavoritesLoading = false;


function displayModalMessage(modalMessageEl: HTMLDivElement, message: string, type: 'error' | 'success') {
    modalMessageEl.textContent = message;
    modalMessageEl.className = `modal-message ${type}`; // Ensure display: block or similar is handled by these classes
    modalMessageEl.style.display = 'block';
}

function clearModalMessage(modalMessageEl: HTMLDivElement | null) {
    if (!modalMessageEl) return; // Guard against null element
    modalMessageEl.textContent = '';
    modalMessageEl.className = 'modal-message';
    modalMessageEl.style.display = 'none';
}

function openModal(modal: HTMLElement) {
    if (!modal) return;

    const messageEl = modal === loginModal ? loginMessage : signupMessage;
    if (messageEl) {
      clearModalMessage(messageEl);
    } else {
      console.warn("Modal message element not found for modal:", modal.id);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // Focus on the first input element if available
    const firstInput = modal.querySelector('input');
    firstInput?.focus();
}

function closeModal(modal: HTMLElement) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
}


if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase URL or Anon Key not detected. Database features (including login/signup, menu saving, and favorites) will be unavailable.");
  if (supabaseStatusIndicator) {
    supabaseStatusIndicator.textContent = "DB Not Configured";
    supabaseStatusIndicator.className = 'status-warning';
  }
  if (authButton) authButton.disabled = true;
  if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
  if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
  if (favoritesButton) favoritesButton.disabled = true;


} else {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized successfully.");
    if (supabaseStatusIndicator) {
      supabaseStatusIndicator.textContent = "DB Ready";
      supabaseStatusIndicator.className = 'status-success';
    }
  } catch (e) {
    console.error("Error initializing Supabase client:", e);
    if (supabaseStatusIndicator) {
      supabaseStatusIndicator.textContent = "DB Error";
      supabaseStatusIndicator.className = 'status-error';
    }
    if (authButton) authButton.disabled = true;
    if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
    if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
    if (favoritesButton) favoritesButton.disabled = true;
  }
}
// --- End Supabase Configuration ---

const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const ingredientsInput = document.getElementById('ingredients-input') as HTMLInputElement;
const dietaryInput = document.getElementById('dietary-input') as HTMLInputElement;
const suggestButton = document.getElementById('suggest-button') as HTMLButtonElement;
const surpriseButton = document.getElementById('surprise-button') as HTMLButtonElement;
const startOverButton = document.getElementById('start-over-button') as HTMLButtonElement;
const usUnitsButton = document.getElementById('us-units-button') as HTMLButtonElement;
const metricUnitsButton = document.getElementById('metric-units-button') as HTMLButtonElement;

let currentUnitSystem: 'us' | 'metric' = 'us';
let lastUserIngredients: string | null = null;
let lastUserDietary: string | null = null;
let lastFetchWasSurprise: boolean = false;
let isLoading = false;
let isUnitUpdatingGlobal: boolean = false;
let lastSuccessfulFetchSeed: number | null = null;


if (!API_KEY) {
  console.error("API_KEY not found. Sousie will not function.");
  if (resultsContainer) {
    const errorElement = document.createElement('div');
    errorElement.className = 'message error-message';
    errorElement.textContent = "Configuration error: Sousie's AI brain is offline (API_KEY missing).";
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(errorElement);
  }
  if (ingredientsInput) ingredientsInput.disabled = true;
  if (dietaryInput) dietaryInput.disabled = true;
  if (suggestButton) suggestButton.disabled = true;
  if (surpriseButton) surpriseButton.disabled = true;
  if (startOverButton) startOverButton.disabled = true;
  if (authButton) authButton.disabled = true;
  if (usUnitsButton) usUnitsButton.disabled = true;
  if (metricUnitsButton) metricUnitsButton.disabled = true;
  if (menuPlannerButton) menuPlannerButton.disabled = true;
  if (favoritesButton) favoritesButton.disabled = true;
  if (generateWeeklyMenuButton) generateWeeklyMenuButton.disabled = true;

}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const SOUSIE_SYSTEM_INSTRUCTION = "You are Sousie, a super friendly, enthusiastic, witty, and creative AI cooking assistant. You're like a fun chef friend in the kitchen! Your recipe descriptions should be encouraging and delightful. For each `mealPairing` you suggest, you MUST provide a distinct `mainRecipe` object and a distinct, complementary `sideRecipe` object. Each of these recipe objects MUST contain: 'name' (MUST be a specific, descriptive, non-empty string), 'description' (a general enticing summary of the dish, 2-3 sentences), 'anecdote' (a short, funny anecdote or charming story related to that specific dish), and 'chefTip' (a 'Chef Sousie's Fun Tip:' or 'Chef's Recommendation:' for that specific dish). CRITICALLY, both `mainRecipe` and `sideRecipe` MUST ALSO provide 'ingredients' as an array of strings (e.g., [\"1 cup flour\", \"2 eggs\"], MUST NOT BE EMPTY, AT LEAST ONE ITEM) and 'instructions' as an array of strings (e.g., [\"Preheat oven.\", \"Mix ingredients.\"], MUST NOT BE EMPTY, AT LEAST ONE ITEM). These arrays should not be empty. You always respond only with the requested JSON object. Pay close attention to the requested unit system for measurements (US Customary or Metric) and ensure all ingredient quantities in your response adhere to it. If dietary restrictions are provided, ensure ALL recipes in every meal pairing strictly adhere to them.";
const SOUSIE_MENU_SYSTEM_INSTRUCTION = "You are Sousie, an expert weekly menu planner and cooking assistant. Your primary goal is to generate a 7-day dinner menu based on user preferences and then create a consolidated, categorized grocery list. For the menu, each day (e.g., 'Monday', 'Tuesday', ...) MUST have a 'mealName' (e.g., 'Spaghetti Carbonara') and a complete 'recipe' object. This 'recipe' object MUST contain: 'name' (same as mealName), 'description' (enticing summary), 'anecdote' (charming story related to the dish), 'chefTip' (Chef Sousie's fun tip), 'ingredients' (array of strings, e.g., ['1 lb spaghetti', '4 large eggs']), and 'instructions' (array of strings). All fields within the recipe object are mandatory and must not be empty. The 'ingredients' and 'instructions' arrays must contain at least one string item each. Respond ONLY with the requested JSON. Adhere strictly to the unit system and dietary restrictions provided by the user for all recipes.";

interface DynamicLoadingMessageParts {
    opener: string;
    svgIcon: string;
    mainMessage: string;
    action: string;
}

function generateDynamicLoadingMessage(ingredientsText?: string): DynamicLoadingMessageParts {
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
        { keyword: "chocolate", text: "Chocolate! My circuits are buzzing with delight! 'Anything is good if it's made of chocolate.' - Jo Brand. Let me whip up something utterly irresistible..." },
        { keyword: "potatoes", text: "Potatoes! The humble hero! 'What I say is that, if a man really likes potatoes, he must be a pretty decent sort of fellow.' - A.A. Milne. Fetching some decent ideas!"},
        { keyword: "spicy", text: "Spicy! Turning up the heat! 'Variety is the spice of life, that gives it all its flavor.' - William Cowper. Let's find something flavorful!"},
        { keyword: "surprise", text: "A surprise! My favorite kind of challenge! 'The greatest discoveries have come from people who have looked at a standard situation and seen it differently.' - V. S. Ramachandran. Preparing a delightful new perspective for your taste buds!"}
    ];
    const generalThoughts = [
        "'Cooking is at once child's play and adult joy.' - Craig Claiborne.",
        "'No one is born a great cook, one learns by doing.' - Julia Child.",
        "The kitchen is my happy place, let's make it yours too!",
        "Ready to turn these ingredients into a story on a plate?"
    ];

    let chosenQuote = "";
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

    if (!chosenQuote) {
        chosenQuote = generalThoughts[Math.floor(Math.random() * generalThoughts.length)];
    }

    const opener = openers[Math.floor(Math.random() * openers.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;

    return {
        opener: opener,
        svgIcon: panSVG,
        mainMessage: chosenQuote,
        action: `Now, Sousie is ${action}`
    };
}

function setLoading(loading: boolean, ingredientsForLoadingMessage?: string) {
  isLoading = loading;
  if (ingredientsInput) ingredientsInput.disabled = loading;
  if (dietaryInput) dietaryInput.disabled = loading;
  if (suggestButton) suggestButton.disabled = loading;
  if (surpriseButton) surpriseButton.disabled = loading;
  if (startOverButton) startOverButton.disabled = loading;

  if (usUnitsButton) usUnitsButton.disabled = loading || isUnitUpdatingGlobal || isMenuPlannerLoading || isFavoritesLoading;
  if (metricUnitsButton) metricUnitsButton.disabled = loading || isUnitUpdatingGlobal || isMenuPlannerLoading || isFavoritesLoading;
  if (menuPlannerButton) menuPlannerButton.disabled = loading || isMenuPlannerLoading || isFavoritesLoading || !API_KEY;
  if (favoritesButton) favoritesButton.disabled = loading || isMenuPlannerLoading || isFavoritesLoading || !API_KEY || !supabaseClient;


  const busyAttr = 'aria-busy';
  if (loading) {
    suggestButton?.setAttribute(busyAttr, 'true');
    surpriseButton?.setAttribute(busyAttr, 'true');

    if (isUnitUpdatingGlobal && resultsContainer.querySelector('.recipe-card')) {
      // Unit update: No big loading message, content is dimmed by CSS
    } else if (currentViewMode === 'recipes' && resultsContainer) { // Only show recipe loading in recipe view
      const messageParts = generateDynamicLoadingMessage(ingredientsForLoadingMessage);
      const sanitizedOpener = sanitizeHTML(messageParts.opener);
      const sanitizedMainMessage = sanitizeHTML(messageParts.mainMessage);
      const sanitizedAction = sanitizeHTML(messageParts.action);

      resultsContainer.innerHTML = `<div class="message loading-message">${sanitizedOpener} ${messageParts.svgIcon} ${sanitizedMainMessage} ${sanitizedAction}</div>`;
    }
  } else {
    suggestButton?.removeAttribute(busyAttr);
    surpriseButton?.removeAttribute(busyAttr);
    // Loading message for recipes is cleared when results are displayed or error occurs
  }
}

function displayError(message: string) {
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
    const errorElement = document.createElement('div');
    errorElement.className = 'message error-message';
    errorElement.textContent = message;
    resultsContainer.appendChild(errorElement);
  }
  lastUserIngredients = null;
  lastUserDietary = null;
  lastFetchWasSurprise = false;
}

function sanitizeHTML(text: string): string {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}


// --- Menu Planner & Favorites Functions ---

function setMenuPlannerLoading(isLoading: boolean, message?: string) { // For Menu Planner
    isMenuPlannerLoading = isLoading;
    if (generateWeeklyMenuButton) generateWeeklyMenuButton.disabled = isLoading;
    if (saveCurrentMenuButton) saveCurrentMenuButton.disabled = isLoading || !currentUser || !currentWeeklyMenuData;
    if (savedMenusDropdown) savedMenusDropdown.disabled = isLoading || !currentUser;

    if (menuPlannerButton) menuPlannerButton.disabled = isLoading || isFavoritesLoading || !API_KEY;
    if (favoritesButton) favoritesButton.disabled = isLoading || isFavoritesLoading || !API_KEY || !supabaseClient;
    if (usUnitsButton) usUnitsButton.disabled = isLoading || isFavoritesLoading || isUnitUpdatingGlobal;
    if (metricUnitsButton) metricUnitsButton.disabled = isLoading || isFavoritesLoading || isUnitUpdatingGlobal;


    if (menuPlannerMessages) {
        if (isLoading) {
            const panSVG = `<svg class="chef-hat-icon-title loading" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
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

function displayMenuPlannerMessage(message: string, type: 'info' | 'error' = 'info') { // For Menu Planner
    if (!menuPlannerMessages) return;
    const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
    menuPlannerMessages.innerHTML = `<div class="message ${type}-message">${panSVG} ${sanitizeHTML(message)}</div>`;
    menuPlannerMessages.style.display = 'block';
    if (weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
    if (groceryListDisplay) groceryListDisplay.innerHTML = '';
}

function setFavoritesLoading(isLoading: boolean, message?: string) { // For Favorites
    isFavoritesLoading = isLoading;
    if (menuPlannerButton) menuPlannerButton.disabled = isLoading || isMenuPlannerLoading || !API_KEY;
    if (favoritesButton) favoritesButton.disabled = isLoading || isMenuPlannerLoading || !API_KEY || !supabaseClient;
    if (usUnitsButton) usUnitsButton.disabled = isLoading || isMenuPlannerLoading || isUnitUpdatingGlobal;
    if (metricUnitsButton) metricUnitsButton.disabled = isLoading || isMenuPlannerLoading || isUnitUpdatingGlobal;

    if (favoritesMessages) {
        if (isLoading) {
            const panSVG = `<svg class="chef-hat-icon-title loading" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
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

function displayFavoritesMessage(message: string, type: 'info' | 'error' = 'info') { // For Favorites
    if (!favoritesMessages) return;
    const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
    favoritesMessages.innerHTML = `<div class="message ${type}-message">${panSVG} ${sanitizeHTML(message)}</div>`;
    favoritesMessages.style.display = 'block';
    if (favoriteRecipesDisplay) favoriteRecipesDisplay.innerHTML = '';
}


function _generateDayMealRecipeHTML(recipe: Recipe, unitSystem: 'us' | 'metric'): string {
    if (!recipe || !recipe.name) {
        return `<div class="recipe-component"><h4 class="recipe-component-title">Recipe Details</h4><p>Sousie's still working on the details for this meal!</p></div>`;
    }

    const ingredientsList = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
        ? recipe.ingredients.map((ing: string) => `<li>${sanitizeHTML(ing)}</li>`).join('')
        : `<li>Sousie says: Ingredients not specified!</li>`;

    const instructionsList = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? recipe.instructions.map((instr: string) => `<li>${sanitizeHTML(instr)}</li>`).join('')
        : `<li>Sousie says: Instructions seem to be missing!</li>`;

    const instructionsHtml = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? `<ol>${instructionsList}</ol>`
        : instructionsList;

    let componentHTML = `<div class="recipe-component">`;
    if (recipe.description) {
         componentHTML += `<p><strong>Description:</strong> ${sanitizeHTML(recipe.description)}</p>`;
    }

    if (recipe.anecdote || recipe.chefTip) {
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


function createDayCard(dayMeal: DayMeal, dayIndex: number): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'day-card expandable';
    const cardUniqueIdPart = `day-${dayIndex}-${(dayMeal.dayName || 'day').replace(/\s+/g, '-').toLowerCase()}`;
    card.setAttribute('data-day-id', cardUniqueIdPart);

    const summary = document.createElement('div');
    summary.className = 'day-card-summary';

    let summaryHTML = `
        <h3>${sanitizeHTML(dayMeal.dayName)}: ${sanitizeHTML(dayMeal.mealName)}</h3>
        <p>${sanitizeHTML(dayMeal.recipe?.description || 'A delightful meal planned by Sousie!')}</p>
        <button class="expand-toggle" aria-expanded="false" aria-controls="details-${cardUniqueIdPart}">
            <span class="toggle-text">Show Recipe</span>
            <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
        </button>
    `;
    summary.innerHTML = summaryHTML;

    const details = document.createElement('div');
    details.className = 'recipe-details';
    details.id = `details-${cardUniqueIdPart}`;
    details.style.display = 'none';
    details.innerHTML = dayMeal.recipe ? _generateDayMealRecipeHTML(dayMeal.recipe, currentUnitSystem) : "<p>Recipe details are unavailable.</p>";

    card.appendChild(summary);
    card.appendChild(details);

    const toggleButton = summary.querySelector('.expand-toggle') as HTMLButtonElement;
    toggleButton.addEventListener('click', () => {
        const isExpanded = card.classList.toggle('expanded');
        details.style.display = isExpanded ? 'block' : 'none';
        toggleButton.setAttribute('aria-expanded', String(isExpanded));
        const toggleText = toggleButton.querySelector('.toggle-text') as HTMLSpanElement;
        const toggleIcon = toggleButton.querySelector('.toggle-icon') as SVGSVGElement;
        if (isExpanded) {
            toggleText.textContent = 'Hide Recipe';
            toggleIcon.innerHTML = '<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/><path d="M0 0h24v24H0z" fill="none"/>';
        } else {
            toggleText.textContent = 'Show Recipe';
            toggleIcon.innerHTML = '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/>';
        }
    });
    return card;
}


function displayWeeklyMenu(menuData: WeeklyMenu) {
    if (!weeklyMenuDisplay || !menuData || !Array.isArray(menuData.weeklyMenu) || menuData.weeklyMenu.length === 0) {
        displayMenuPlannerMessage("Sousie couldn't generate a weekly menu this time. Please try again!", "error");
        return;
    }
    weeklyMenuDisplay.innerHTML = '<h2>Your 7-Day Dinner Menu</h2>';
    const grid = document.createElement('div');
    grid.className = 'weekly-menu-grid';

    menuData.weeklyMenu.forEach((dayMeal, index) => {
        if (dayMeal && dayMeal.recipe) { // Ensure dayMeal and its recipe are valid
            grid.appendChild(createDayCard(dayMeal, index));
        }
    });
    weeklyMenuDisplay.appendChild(grid);
    if (menuPlannerMessages && menuPlannerMessages.querySelector('.loading-message')) {
        menuPlannerMessages.innerHTML = '';
        menuPlannerMessages.style.display = 'none';
    }
    if(saveCurrentMenuButton) saveCurrentMenuButton.disabled = !currentUser;
}

function displayGroceryList(groceryData: { groceryList: GroceryListCategory[] }) {
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
            const li = document.createElement('li');
            li.textContent = 'No items in this category.';
            ul.appendChild(li);
        }
        categoryDiv.appendChild(ul);
        groceryListDisplay.appendChild(categoryDiv);
    });
}

async function handleGenerateGroceryList() {
    if (!ai || !API_KEY || !currentWeeklyMenuData) {
        displayMenuPlannerMessage("Cannot generate grocery list without a menu or AI.", "error");
        return;
    }
    setMenuPlannerLoading(true, "Creating your grocery list...");

    const unitSystemInstructions = `Ensure all ingredient quantities in the grocery list are consistent with the ${currentUnitSystem === 'us' ? 'US Customary' : 'Metric'} system used in the recipes.`;

    const prompt = `Given the following 7-day dinner menu JSON:
${JSON.stringify(currentWeeklyMenuData)}

Please aggregate all ingredients from all recipes into a single, consolidated grocery list.
The grocery list should be categorized (e.g., Produce, Dairy & Eggs, Meat & Poultry, Seafood, Pantry Staples, Spices & Herbs, Frozen, Other).
Combine identical items and sum their quantities (e.g., if Day 1 needs "1 onion" and Day 3 needs "2 onions", the list should show "3 onions" or "onions, 3 total").
${unitSystemInstructions}
Respond ONLY with a JSON object in the following format:
{"groceryList": [
  {"category": "Produce", "items": ["3 onions", "1 head garlic", "2 lbs potatoes"]},
  {"category": "Meat & Poultry", "items": ["1 lb chicken breast", "500g ground beef"]},
  ... more categories
]}
Each item in the "items" array should be a string, preferably with quantity and unit if applicable.
Do not include instructions or any other text outside the JSON structure.`;

    let jsonStrToParse = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                systemInstruction: SOUSIE_MENU_SYSTEM_INSTRUCTION,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        let rawJsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = rawJsonStr.match(fenceRegex);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawJsonStr;

        currentGroceryListData = JSON.parse(jsonStrToParse);
        displayGroceryList(currentGroceryListData);
    } catch (error) {
        console.error("Error generating grocery list:", error);
        console.error("Malformed JSON for grocery list:", jsonStrToParse);
        displayMenuPlannerMessage("Sousie had trouble making the grocery list. You can try regenerating the menu.", "error");
        if(groceryListDisplay) groceryListDisplay.innerHTML = '<p>Error creating grocery list.</p>';
    } finally {
        setMenuPlannerLoading(false);
    }
}


async function handleGenerateWeeklyMenu() {
    if (!ai || !API_KEY) return;

    setMenuPlannerLoading(true, "Dreaming up a delicious week for you...");
    if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
    if(groceryListDisplay) groceryListDisplay.innerHTML = '';

    const dietaryRestrictions = dietaryInput.value.trim() || 'None';
    const unitSystemInstructions = `All ingredient quantities in recipes MUST be in ${currentUnitSystem === 'us' ? 'US Customary (cups, oz, lbs, tsp, tbsp)' : 'Metric (ml, grams, kg, L)'} units.`;

    const recipeObjectJsonFormat = `"name": "Specific Recipe Name", "description": "Enticing summary.", "anecdote": "Charming story.", "chefTip": "Chef Sousie's fun tip.", "ingredients": ["1 cup flour"], "instructions": ["Preheat oven." ]`;
    const prompt = `Generate a 7-day dinner menu. For each day (Monday to Sunday), provide a "dayName", a unique "mealName" for the dinner, and a complete "recipe" object.
The "recipe" object for each day MUST include: ${recipeObjectJsonFormat}.
Dietary restrictions: "${dietaryRestrictions}". ALL recipes MUST adhere to this.
${unitSystemInstructions}
The final response MUST be a single JSON object structured as:
{"weeklyMenu": [
  {"dayName": "Monday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Tuesday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Wednesday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Thursday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Friday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Saturday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}},
  {"dayName": "Sunday", "mealName": "...", "recipe": {${recipeObjectJsonFormat}}}
]}
Ensure all fields are filled, especially 'ingredients' and 'instructions' arrays which MUST NOT be empty. Only provide the JSON.`;

    let jsonStrToParse = "";
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                systemInstruction: SOUSIE_MENU_SYSTEM_INSTRUCTION,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        let rawJsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = rawJsonStr.match(fenceRegex);
        jsonStrToParse = match && match[2] ? match[2].trim() : rawJsonStr;

        currentWeeklyMenuData = JSON.parse(jsonStrToParse);
        if (currentWeeklyMenuData && currentWeeklyMenuData.weeklyMenu && currentWeeklyMenuData.weeklyMenu.length > 0) {
            displayWeeklyMenu(currentWeeklyMenuData);
            await handleGenerateGroceryList();
        } else {
            throw new Error("Parsed menu data is empty or invalid.");
        }
    } catch (error) {
        console.error("Error generating weekly menu:", error);
        console.error("Malformed JSON for weekly menu:", jsonStrToParse);
        displayMenuPlannerMessage("Oh dear! Sousie couldn't cook up a full weekly menu right now. Please try again.", "error");
        currentWeeklyMenuData = null;
    } finally {
        setMenuPlannerLoading(false);
    }
}


async function populateSavedMenusDropdown() {
    if (!supabaseClient || !currentUser || !savedMenusDropdown) return;
    savedMenusDropdown.innerHTML = '<option value="">Load a saved menu...</option>';

    try {
        const { data, error } = await supabaseClient
            .from('user_menus')
            .select('id, menu_name')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        currentSavedUserMenus = data || [];
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
        displayMenuPlannerMessage("Could not load your saved menus.", "error");
        savedMenusDropdown.style.display = 'none';
        if(menuPlannerControls) menuPlannerControls.classList.remove('has-saved-menus');
    }
}

async function handleSaveCurrentMenu() {
    if (!supabaseClient || !currentUser || !currentWeeklyMenuData) {
        alert("You need to be logged in and have a menu generated to save it.");
        return;
    }

    const menuName = prompt("Enter a name for this weekly menu (e.g., 'Family Favorites - Week 1'):");
    if (!menuName || menuName.trim() === "") {
        alert("Menu name cannot be empty.");
        return;
    }

    setMenuPlannerLoading(true, "Saving your menu...");
    try {
        const { error } = await supabaseClient.from('user_menus').insert({
            user_id: currentUser.id,
            menu_name: menuName.trim(),
            menu_data: currentWeeklyMenuData
        });
        if (error) throw error;
        alert("Menu saved successfully!");
        await populateSavedMenusDropdown();
    } catch (error: any) {
        console.error("Error saving menu:", error.message);
        alert(`Failed to save menu: ${error.message}`);
    } finally {
        setMenuPlannerLoading(false);
    }
}

async function handleLoadSavedMenu() {
    if (!supabaseClient || !currentUser || !savedMenusDropdown || !savedMenusDropdown.value) return;

    const menuId = savedMenusDropdown.value;
    setMenuPlannerLoading(true, "Loading your saved menu...");
    if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
    if(groceryListDisplay) groceryListDisplay.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('user_menus')
            .select('menu_data')
            .eq('id', menuId)
            .eq('user_id', currentUser.id)
            .single();

        if (error) throw error;

        if (data && data.menu_data) {
            currentWeeklyMenuData = data.menu_data as WeeklyMenu;
            if (currentWeeklyMenuData && currentWeeklyMenuData.weeklyMenu) {
                 displayWeeklyMenu(currentWeeklyMenuData);
                 await handleGenerateGroceryList();
            } else {
                throw new Error("Loaded menu data is not in the expected format.");
            }
        } else {
            throw new Error("No data found for the selected menu.");
        }
    } catch (error: any) {
        console.error("Error loading saved menu:", error.message);
        displayMenuPlannerMessage(`Failed to load menu: ${error.message}`, "error");
        currentWeeklyMenuData = null;
    } finally {
        setMenuPlannerLoading(false);
    }
}

async function displayUserFavorites() {
    if (!favoriteRecipesDisplay) return;
    if (!currentUser || !supabaseClient) {
        displayFavoritesMessage("Please log in to see your favorite recipes.", "info");
        return;
    }

    setFavoritesLoading(true, "Fetching your favorite recipes...");
    favoriteRecipesDisplay.innerHTML = ''; // Clear previous favorites

    try {
        const { data, error } = await supabaseClient
            .from('user_liked_recipes')
            .select('recipe_identifier, recipe_name, recipe_data, liked_at')
            .eq('user_id', currentUser.id)
            .order('liked_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'recipes-grid'; // Reuse recipe grid styling

            data.forEach((likedRecipe: LikedRecipeFromDB, index: number) => {
                if (likedRecipe.recipe_data && typeof likedRecipe.recipe_data === 'object' && likedRecipe.recipe_data.name) {
                    const mealPairingFromFavorite = {
                        mealTitle: likedRecipe.recipe_name || likedRecipe.recipe_data.name,
                        mainRecipe: likedRecipe.recipe_data,
                        // sideRecipe is intentionally null or undefined for favorites, as we only store the main liked recipe.
                    };
                    const card = createExpandableRecipeCard(mealPairingFromFavorite, `favorite-${index}`, true); // Pass true for isFavoriteCard
                    grid.appendChild(card);
                } else {
                    console.warn("Skipping favorite with missing or invalid recipe_data:", likedRecipe);
                }
            });
            if (grid.children.length > 0) {
                favoriteRecipesDisplay.appendChild(grid);
            } else {
                 displayFavoritesMessage("You haven't liked any recipes yet. Go explore and find some favorites!", "info");
            }

        } else {
            displayFavoritesMessage("You haven't liked any recipes yet. Go explore and find some favorites!", "info");
        }

    } catch (err: any) {
        console.error("Error fetching favorite recipes:", err.message);
        displayFavoritesMessage("Oops! Couldn't load your favorite recipes. Please try again.", "error");
    } finally {
        setFavoritesLoading(false);
    }
}


function switchToView(view: 'recipes' | 'menuPlanner' | 'favorites') {
    currentViewMode = view;

    if (recipeSuggestionsView) recipeSuggestionsView.classList.add('hidden-view');
    if (menuPlannerView) menuPlannerView.classList.add('hidden-view');
    if (favoritesView) favoritesView.classList.add('hidden-view');

    if (menuPlannerButton) menuPlannerButton.classList.remove('active');
    if (favoritesButton) favoritesButton.classList.remove('active');

    // Show/hide footer (chat box)
    if (footerElement) {
        if (view === 'menuPlanner' || view === 'favorites') {
            footerElement.classList.add('footer-hidden');
        } else { // 'recipes' view
            footerElement.classList.remove('footer-hidden');
        }
    }


    if (view === 'menuPlanner') {
        if (menuPlannerView) menuPlannerView.classList.remove('hidden-view');
        if (menuPlannerButton) menuPlannerButton.classList.add('active');

        if (!currentWeeklyMenuData && menuPlannerMessages && !isMenuPlannerLoading) {
             const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
            displayMenuPlannerMessage(`${panSVG} Let's plan your week! Click "Generate Weekly Menu" to start.`);
        }
        if (currentUser) {
            populateSavedMenusDropdown();
            if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'inline-block';
            if (saveCurrentMenuButton) saveCurrentMenuButton.disabled = !currentWeeklyMenuData || isMenuPlannerLoading;
            if (savedMenusDropdown) savedMenusDropdown.style.display = 'inline-block';
        } else {
            if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
            if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
        }
    } else if (view === 'favorites') {
        if (favoritesView) favoritesView.classList.remove('hidden-view');
        if (favoritesButton) favoritesButton.classList.add('active');
        displayUserFavorites();
    } else { // 'recipes' view
        if (recipeSuggestionsView) recipeSuggestionsView.classList.remove('hidden-view');
        if (API_KEY && resultsContainer && resultsContainer.innerHTML.trim() === '' && !isLoading) {
            const panSVGInitial = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
            resultsContainer.innerHTML = `<div class="message info-message">${panSVGInitial}Welcome to Sousie's Kitchen! What delicious ingredients are we working with today? Or try a 'Surprise Me!'</div>`;
        }
    }
}


// --- Like Button Functionality ---
async function handleLikeRecipe(recipeIdentifier: string, recipeName: string, recipeData: Recipe | null) {
    if (!currentUser || !supabaseClient) {
        console.warn("User not logged in or Supabase client not available. Cannot save like.");
        return;
    }
    if (!recipeData) {
        console.error("No recipe data provided to save for like.");
        alert("Could not save like: recipe details are missing.");
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('user_liked_recipes')
            .upsert({
                user_id: currentUser.id,
                recipe_identifier: recipeIdentifier,
                recipe_name: recipeName,
                recipe_data: recipeData
            }, { onConflict: 'user_id, recipe_identifier' });

        if (error) throw error;
        console.log(`Recipe "${recipeName}" (ID: ${recipeIdentifier}) liked and saved by user ${currentUser.id}.`);
    } catch (error: any) {
        console.error("Error saving like to Supabase:", error.message);
        alert("Oh dear! Sousie couldn't save your like right now. Please try again.");
    }
}

async function handleUnlikeRecipe(recipeIdentifier: string, cardElementToRemove?: HTMLElement) {
    if (!currentUser || !supabaseClient) {
        console.warn("User not logged in or Supabase client not available. Cannot remove like.");
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('user_liked_recipes')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('recipe_identifier', recipeIdentifier);

        if (error) throw error;
        console.log(`Recipe ID "${recipeIdentifier}" unliked and removed by user ${currentUser.id}.`);
        if (cardElementToRemove && cardElementToRemove.parentNode) {
            cardElementToRemove.parentNode.removeChild(cardElementToRemove);
            if (favoriteRecipesDisplay && favoriteRecipesDisplay.children.length === 0) {
                 displayFavoritesMessage("No more favorites here! Go find some new ones!", "info");
            }
        }
    } catch (error: any) {
        console.error("Error removing like from Supabase:", error.message);
        alert("Oh crumbs! Sousie couldn't remove your like. Please try refreshing or checking again later.");
    }
}
// --- End Like Button Functionality ---


function _generateRecipeComponentHTML(recipe: any, componentType: 'Main Dish' | 'Side Dish' | 'Dessert', unitSystem: 'us' | 'metric'): string {
    if (!recipe || !recipe.name) {
        const typeName = componentType.toLowerCase();
        if (componentType === 'Side Dish') {
            return `<div class="recipe-component"><h4 class="recipe-component-title">${componentType}</h4><p>Sousie didn't suggest a specific side for this meal.</p></div>`;
        }
         if (componentType === 'Dessert') {
            return `<div class="recipe-component"><h4 class="recipe-component-title">${componentType}</h4><p>Sousie didn't suggest a specific dessert for this meal pairing.</p></div>`;
        }
        return `<div class="recipe-component"><h4 class="recipe-component-title">${componentType}</h4><p>Sousie's still working on the details for this ${typeName}!</p></div>`;
    }

    const ingredientsList = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
        ? recipe.ingredients.map((ing: string) => `<li>${sanitizeHTML(ing)}</li>`).join('')
        : `<li>Sousie says: Ingredients not specified for this ${componentType.toLowerCase()}!</li>`;

    const instructionsList = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? recipe.instructions.map((instr: string) => `<li>${sanitizeHTML(instr)}</li>`).join('')
        : (recipe.instructions && typeof recipe.instructions === 'string'
            ? `<p>${sanitizeHTML(recipe.instructions).replace(/\n/g, '<br>')}</p>`
            : `<li>Sousie says: Instructions seem to be missing for this ${componentType.toLowerCase()}!</li>`);

    const instructionsHtml = Array.isArray(recipe.instructions) && recipe.instructions.length > 0
        ? `<ol>${instructionsList}</ol>`
        : instructionsList;

    let componentHTML = `<div class="recipe-component">`;
    componentHTML += `<h4 class="recipe-component-title">${componentType}: ${sanitizeHTML(recipe.name)}</h4>`;

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


function createExpandableRecipeCard(mealPairing: any, cardIdPrefix: string | number, isFavoriteCard: boolean = false): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'recipe-card expandable';
    const overallName = mealPairing.mealTitle || mealPairing.mainRecipe?.name || 'Unnamed Meal';
    const mainRecipeData = mealPairing.mainRecipe || ({} as Recipe);
    const recipeIdentifier = (mainRecipeData.name || 'unknown-recipe').replace(/\s+/g, '-').toLowerCase();

    const cardUniqueIdPart = `${cardIdPrefix}-${recipeIdentifier.replace(/[^a-zA-Z0-9-]/g, '')}`;
    card.setAttribute('data-recipe-id', cardUniqueIdPart);
    card.setAttribute('data-recipe-name', overallName);
    card.setAttribute('data-recipe-identifier', recipeIdentifier);


    const likeButton = document.createElement('button');
    likeButton.className = 'like-button';
    likeButton.setAttribute('aria-label', `Like ${overallName}`);
    likeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"/></svg>`;

    if (isFavoriteCard) { // Pre-set if it's a card on the favorites page
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
            openModal(loginModal);
            return;
        }

        const isNowLiked = likeButton.classList.toggle('liked');
        likeButton.setAttribute('aria-pressed', String(isNowLiked));

        if (isNowLiked) {
            handleLikeRecipe(currentRecipeIdentifier, currentRecipeName, mainRecipeData);
        } else {
            const elementToRemove = (currentViewMode === 'favorites') ? card : undefined;
            handleUnlikeRecipe(currentRecipeIdentifier, elementToRemove);
        }
    });

    const summary = document.createElement('div');
    summary.className = 'recipe-summary';

    let summaryHTML = `
        <h3>${sanitizeHTML(overallName)}</h3>
        <p>${sanitizeHTML(mainRecipeData.description || 'Sousie is preparing a delightful description for this meal!')}</p>
    `;

    if (mainRecipeData.anecdote || mainRecipeData.chefTip) {
        summaryHTML += `<div class="sousie-extra-info">`;
        summaryHTML += `<h4><svg class="extra-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 2s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> Sousie's Story & Tips</h4>`;
        if (mainRecipeData.anecdote) {
            summaryHTML += `<p class="anecdote-text"><em>"${sanitizeHTML(mainRecipeData.anecdote)}"</em></p>`;
        }
        if (mainRecipeData.chefTip) {
            summaryHTML += `<p class="chef-tip-text"><strong>Chef's Tip:</strong> ${sanitizeHTML(mainRecipeData.chefTip)}</p>`;
        }
        summaryHTML += `</div>`;
    }

    summaryHTML += `
        <button class="expand-toggle" aria-expanded="false" aria-controls="details-${cardUniqueIdPart}">
            <span class="toggle-text">Show Meal Details</span>
            <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18px" height="18px"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
        </button>
    `;
    summary.innerHTML = summaryHTML;


    const details = document.createElement('div');
    details.className = 'recipe-details';
    details.id = `details-${cardUniqueIdPart}`;
    details.style.display = 'none';

    let detailsHTML = '';
    if (mealPairing.mainRecipe) {
        detailsHTML += _generateRecipeComponentHTML(mealPairing.mainRecipe, "Main Dish", currentUnitSystem);
    } else {
        detailsHTML += _generateRecipeComponentHTML({ name: "Main Dish Data Missing" }, "Main Dish", currentUnitSystem);
    }

    if (!isFavoriteCard && mealPairing.sideRecipe && mealPairing.sideRecipe.name) {
        const sideRecipeNameLower = mealPairing.sideRecipe.name.toLowerCase();
        const sideRecipeDescLower = mealPairing.sideRecipe.description?.toLowerCase() || "";
        const isDessert = sideRecipeNameLower.includes("dessert") || sideRecipeDescLower.includes("dessert") ||
                          sideRecipeNameLower.includes("cake") || sideRecipeDescLower.includes("cake") ||
                          sideRecipeNameLower.includes("pie") || sideRecipeDescLower.includes("pie") ||
                          sideRecipeNameLower.includes("cookies") || sideRecipeDescLower.includes("cookies") ||
                          sideRecipeNameLower.includes("ice cream") || sideRecipeDescLower.includes("ice cream") ||
                          sideRecipeNameLower.includes("pudding") || sideRecipeDescLower.includes("pudding") ||
                          sideRecipeNameLower.includes("fruit salad") || sideRecipeDescLower.includes("fruit salad");

        detailsHTML += _generateRecipeComponentHTML(mealPairing.sideRecipe, isDessert ? "Dessert" : "Side Dish", currentUnitSystem);
    } else if (!isFavoriteCard) {
         detailsHTML += `<div class="recipe-component"><h4 class="recipe-component-title">Side Dish / Dessert</h4><p>Sousie didn't specify a side or dessert for this particular meal idea.</p></div>`;
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
        const toggleIcon = toggleButton.querySelector('.toggle-icon') as SVGSVGElement;
        if (isExpanded) {
            toggleText.textContent = 'Hide Meal Details';
            toggleIcon.innerHTML = '<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/><path d="M0 0h24v24H0z" fill="none"/>';
        } else {
            toggleText.textContent = 'Show Meal Details';
            toggleIcon.innerHTML = '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/><path d="M0 0h24v24H0z" fill="none"/>';
        }
    });
    return card;
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
        resultsContainer.innerHTML = '<div class="message info-message">Sousie found some ideas, but they weren\'t quite ready for a full meal pairing. Try again!</div>';
    }
  } else {
    resultsContainer.innerHTML = '<div class="message info-message">Sousie pondered, but couldn\'t find specific meal pairings for that. Try different ingredients or ask for a surprise!</div>';
  }
  resultsContainer.scrollTop = 0;
}


async function handleSuggestRecipes(ingredientsQuery?: string) {
  if (!ai || !API_KEY || isLoading) return;
  const ingredients = ingredientsQuery || ingredientsInput.value.trim();
  const dietaryRestrictions = dietaryInput.value.trim();

  if (!ingredients) {
    displayError("Sousie needs some ingredients to work her magic! Please enter some.");
    return;
  }

  setLoading(true, ingredients);
  if (!isUnitUpdatingGlobal) {
    lastUserIngredients = ingredients;
    lastUserDietary = dietaryRestrictions;
    lastFetchWasSurprise = false;
  }

  let seedForCurrentApiCall: number;
  if (isUnitUpdatingGlobal && lastSuccessfulFetchSeed !== null) {
    seedForCurrentApiCall = lastSuccessfulFetchSeed;
  } else {
    seedForCurrentApiCall = Math.floor(Math.random() * 1000000);
  }

  const ingredientList = ingredients.split(',').map(i => i.trim()).filter(i => i);
  if (ingredientList.length === 0) {
      displayError("Please tell Sousie what ingredients you have!");
      setLoading(false);
      return;
  }

  const unitInstructions = currentUnitSystem === 'us'
    ? "Please provide all ingredient quantities in US Customary units (e.g., cups, oz, lbs, tsp, tbsp)."
    : "Please provide all ingredient quantities in Metric units (e.g., ml, grams, kg, L).";

  const recipeObjectJsonFormat = `"name": "Recipe Name (MUST be specific and non-empty)", "description": "General enticing description (2-3 sentences).", "anecdote": "A delightful story or funny anecdote about this dish.", "chefTip": "Chef Sousie's unique Fun Tip or Recommendation for this dish.", "ingredients": ["simple string: 1 cup flour (MUST NOT BE EMPTY, at least one item)"], "instructions": ["simple string: Preheat oven. (MUST NOT BE EMPTY, at least one item)" ]`;

  let dietaryClause = "";
  let currentDietaryForPrompt = dietaryRestrictions;
  if(isUnitUpdatingGlobal && lastUserDietary !== null) {
      currentDietaryForPrompt = lastUserDietary;
  }

  if (currentDietaryForPrompt) {
    dietaryClause = `CRITICALLY IMPORTANT: All suggested recipes (both main and side) MUST strictly adhere to the following dietary restrictions: "${currentDietaryForPrompt}". Do not suggest any recipes that violate these restrictions.`;
  }


  const ingredientsString = ingredientList.join(' and ');
  let promptUserMessage = `Hi Sousie, my AI Chef! I have these ingredients: "${ingredientsString}".
  Please suggest exactly 4 distinct and creative "mealPairings". Each "mealPairing" MUST include:
  1. An optional "mealTitle" for the overall meal (e.g., "Hearty Steak Dinner with Roasted Asparagus").
  2. A "mainRecipe" object.
  3. A "sideRecipe" object (this could be a traditional side, a complementary salad, or a suitable dessert if the ingredients lend themselves to it, e.g., if 'peaches' were an ingredient, a peach dessert could be the 'sideRecipe').
  ${unitInstructions}
  ${dietaryClause}
  Both the "mainRecipe" and "sideRecipe" objects MUST EACH contain: ${recipeObjectJsonFormat}. The 'name', 'ingredients', and 'instructions' fields for BOTH mainRecipe and sideRecipe are MANDATORY and MUST NOT BE EMPTY, and their 'ingredients' and 'instructions' arrays must contain at least one string item each.
  Crucially, for each recipe object (mainRecipe and sideRecipe), ensure the 'ingredients' array (e.g., ["item A", "item B"]) is properly closed with a ']', followed immediately by a comma, and then the '"instructions": [' key with its own array of strings (e.g., ], "instructions": ["step X", "step Y"]). Do not insert any other text or keys between the end of the ingredients array and the start of the 'instructions' key-value pair.
  So, the final JSON structure must be:
  {"mealPairings": [
    {"mealTitle": "Optional Title 1", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Optional Title 2", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Optional Title 3", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Optional Title 4", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}}
  ]}.
  Ensure all recipes are unique and complete. Only provide the JSON object in your response. Thanks!`;


  let jsonStrToParse = "";
  try {
    if (!ai) throw new Error("AI client not initialized.");
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: promptUserMessage,
        config: {
            responseMimeType: "application/json",
            systemInstruction: SOUSIE_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingBudget: 0 },
            seed: seedForCurrentApiCall
        },
    });

    let rawJsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = rawJsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStrToParse = match[2].trim();
    } else {
        jsonStrToParse = rawJsonStr;
    }

    const data = JSON.parse(jsonStrToParse);
    if (!isUnitUpdatingGlobal) {
        lastSuccessfulFetchSeed = seedForCurrentApiCall;
    }
    displayResults(data, 'recipes');

  } catch (error: any) {
    console.error("Error fetching recipes from Sousie:", error);
    console.error("Malformed JSON string for 'Suggest Recipes' was:", jsonStrToParse);
    displayError("Oh no! Sousie had a little trouble fetching recipes. Please check the ingredients or try again later.");
  } finally {
    setLoading(false);
  }
}

async function handleSurpriseMe() {
  if (!ai || !API_KEY || isLoading) return;
  const dietaryRestrictions = dietaryInput.value.trim();

  setLoading(true, "a delightful surprise");
  if (!isUnitUpdatingGlobal) {
    lastFetchWasSurprise = true;
    lastUserIngredients = null;
    lastUserDietary = dietaryRestrictions;
  }

  let seedForCurrentApiCall: number;
  if (isUnitUpdatingGlobal && lastSuccessfulFetchSeed !== null) {
    seedForCurrentApiCall = lastSuccessfulFetchSeed;
  } else {
    seedForCurrentApiCall = Math.floor(Math.random() * 1000000);
  }

  const unitInstructions = currentUnitSystem === 'us'
    ? "Please provide all ingredient quantities in US Customary units (e.g., cups, oz, lbs, tsp, tbsp)."
    : "Please provide all ingredient quantities in Metric units (e.g., ml, grams, kg, L).";

  const recipeObjectJsonFormat = `"name": "Recipe Name (MUST be specific and non-empty)", "description": "General enticing description (2-3 sentences).", "anecdote": "A delightful story or funny anecdote about this dish.", "chefTip": "Chef Sousie's unique Fun Tip or Recommendation for this dish.", "ingredients": ["simple string: 1 cup flour (MUST NOT BE EMPTY, at least one item)"], "instructions": ["simple string: Preheat oven. (MUST NOT BE EMPTY, at least one item)" ]`;

  let dietaryClause = "";
  let currentDietaryForPrompt = dietaryRestrictions;
  if(isUnitUpdatingGlobal && lastUserDietary !== null) {
      currentDietaryForPrompt = lastUserDietary;
  }

  if (currentDietaryForPrompt) {
    dietaryClause = `CRITICALLY IMPORTANT: All suggested recipes (both main and side) MUST strictly adhere to the following dietary restrictions: "${currentDietaryForPrompt}". Do not suggest any recipes that violate these restrictions.`;
  }

  let promptUserMessage = `Sousie, my favorite AI Chef! Please surprise me with exactly 4 distinct, interesting, and delicious "mealPairings". Each "mealPairing" MUST include:
  1. An optional "mealTitle" for the overall meal.
  2. A "mainRecipe" object.
  3. A "sideRecipe" object (this could be a traditional side, a complementary salad, or a suitable dessert).
  ${unitInstructions}
  ${dietaryClause}
  Both the "mainRecipe" and "sideRecipe" objects MUST EACH contain: ${recipeObjectJsonFormat}. The 'name', 'ingredients', and 'instructions' fields for BOTH mainRecipe and sideRecipe are MANDATORY and MUST NOT BE EMPTY, and their 'ingredients' and 'instructions' arrays must contain at least one string item each.
  Crucially, for each recipe object (mainRecipe and sideRecipe), ensure the 'ingredients' array (e.g., ["item A", "item B"]) is properly closed with a ']', followed immediately by a comma, and then the '"instructions": [' key with its own array of strings (e.g., ], "instructions": ["step X", "step Y"]). Do not insert any other text or keys between the end of the ingredients array and the start of the 'instructions' key-value pair.
  So, the final JSON structure must be:
  {"mealPairings": [
    {"mealTitle": "Surprise Meal 1 Title", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Surprise Meal 2 Title", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Surprise Meal 3 Title", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}},
    {"mealTitle": "Surprise Meal 4 Title", "mainRecipe": {${recipeObjectJsonFormat}}, "sideRecipe": {${recipeObjectJsonFormat}}}
  ]}.
  Ensure all recipes are unique and complete. Only provide the JSON object in your response. Thanks!`;


  let jsonStrToParse = "";
  try {
    if (!ai) throw new Error("AI client not initialized.");
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: promptUserMessage,
        config: {
            responseMimeType: "application/json",
            systemInstruction: SOUSIE_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingBudget: 0 },
            seed: seedForCurrentApiCall
        },
    });

    let rawJsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = rawJsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStrToParse = match[2].trim();
    } else {
        jsonStrToParse = rawJsonStr;
    }

    const data = JSON.parse(jsonStrToParse);
    if (!isUnitUpdatingGlobal) {
        lastSuccessfulFetchSeed = seedForCurrentApiCall;
    }
    displayResults(data, 'surprise');

  } catch (error) {
    console.error("Error fetching surprise recipe from Sousie:", error);
    console.error("Malformed JSON string for 'Surprise Me' was:", jsonStrToParse);
    displayError("Oops! Sousie couldn't conjure her surprise recipes this time. Please try again!");
  } finally {
    setLoading(false);
  }
}

function handleStartOver() {
    if (isLoading) return;
    ingredientsInput.value = '';
    dietaryInput.value = '';
    const panSVG = `<svg class="chef-hat-icon-title" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><path d="M151.552 143.4l91.208-91.207a10.97 10.97 0 0 0 0-15.514L227.246 21.16a10.97 10.97 0 0 0-15.514 0L120.52 112.37l25.842 25.842 5.19 5.189z" fill="#273347"/><path d="M131.623 241.667c61.662 0 111.66-49.998 111.66-111.66 0-61.662-49.998-111.66-111.66-111.66-61.662 0-111.66 49.998-111.66 111.66 0 61.662 49.998 111.66 111.66 111.66zm0-15.514c-53.076 0-96.146-43.07-96.146-96.146s43.07-96.146 96.146-96.146 96.146 43.07 96.146 96.146-43.07 96.146-96.146 96.146z" fill="#FF7A2F"/></g></svg>`;
    if (resultsContainer) resultsContainer.innerHTML = `<div class="message info-message">${panSVG}Ready for new ideas! What ingredients does Sousie have to work with today?</div>`;
    ingredientsInput.focus();
    lastUserIngredients = null;
    lastUserDietary = null;
    lastFetchWasSurprise = false;
    lastSuccessfulFetchSeed = null;
}

async function handleUnitChange(newSystem: 'us' | 'metric') {
    if (isLoading || isMenuPlannerLoading || isFavoritesLoading || currentUnitSystem === newSystem) return;

    currentUnitSystem = newSystem;
    if(usUnitsButton) usUnitsButton.classList.toggle('active', newSystem === 'us');
    if(usUnitsButton) usUnitsButton.setAttribute('aria-pressed', String(newSystem === 'us'));
    if(metricUnitsButton) metricUnitsButton.classList.toggle('active', newSystem === 'metric');
    if(metricUnitsButton) metricUnitsButton.setAttribute('aria-pressed', String(newSystem === 'metric'));

    isUnitUpdatingGlobal = true;
    if (usUnitsButton) usUnitsButton.disabled = true;
    if (metricUnitsButton) metricUnitsButton.disabled = true;

    if (currentViewMode === 'recipes' && resultsContainer && resultsContainer.querySelector('.recipe-card')) {
        resultsContainer.classList.add('content-stale-for-unit-update');
        setLoading(true, "units");

        const fetchPromise = lastUserIngredients
            ? handleSuggestRecipes(lastUserIngredients)
            : (lastFetchWasSurprise ? handleSurpriseMe() : Promise.resolve());
        try {
            await fetchPromise;
        } catch (error) {
            console.error("Recipe view unit change re-fetch failed:", error);
        } finally {
            resultsContainer.classList.remove('content-stale-for-unit-update');
            // setLoading(false) is called inside handleSuggestRecipes/handleSurpriseMe
        }
    } else if (currentViewMode === 'menuPlanner' && currentWeeklyMenuData && menuPlannerView) {
        menuPlannerView.classList.add('content-stale-for-unit-update');
        setMenuPlannerLoading(true, "Updating units for your menu...");
        displayWeeklyMenu(currentWeeklyMenuData);
        if (currentGroceryListData) { // Re-gen grocery list if menu exists
            await handleGenerateGroceryList();
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for UI
        menuPlannerView.classList.remove('content-stale-for-unit-update');
        setMenuPlannerLoading(false);
    } else if (currentViewMode === 'favorites' && favoritesView && favoriteRecipesDisplay && favoriteRecipesDisplay.querySelector('.recipe-card')) {
        favoritesView.classList.add('content-stale-for-unit-update');
        setFavoritesLoading(true, "Updating units for your favorites...");
        await displayUserFavorites(); // Re-fetch and display favorites with new units
        await new Promise(resolve => setTimeout(resolve, 200));
        favoritesView.classList.remove('content-stale-for-unit-update');
        setFavoritesLoading(false);
    }

    isUnitUpdatingGlobal = false;
    // Re-enable unit buttons based on current main loading state
    if (usUnitsButton) usUnitsButton.disabled = isLoading || isMenuPlannerLoading || isFavoritesLoading;
    if (metricUnitsButton) metricUnitsButton.disabled = isLoading || isMenuPlannerLoading || isFavoritesLoading;
}

// --- Authentication Logic ---
function updateAuthUI(user: InstanceType<typeof User> | null) {
    currentUser = user;
    const isLoggedIn = !!user;

    if (authButtonText) authButtonText.textContent = isLoggedIn ? 'Logout' : 'Login';
    if (userInfoDisplay) {
        userInfoDisplay.textContent = isLoggedIn ? `Hi, ${user.email?.split('@')[0] || 'User'}!` : '';
        userInfoDisplay.title = isLoggedIn ? (user.email || '') : '';
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

    // Menu Planner specific UI
    if (currentViewMode === 'menuPlanner') {
        if (isLoggedIn) {
            populateSavedMenusDropdown();
            if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'inline-block';
            if (saveCurrentMenuButton) saveCurrentMenuButton.disabled = !currentWeeklyMenuData || isMenuPlannerLoading;
            if (savedMenusDropdown) savedMenusDropdown.style.display = 'inline-block';
        } else {
            currentSavedUserMenus = [];
            if (savedMenusDropdown) savedMenusDropdown.innerHTML = '<option value="">Login to see saved menus</option>';
            if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
            if (menuPlannerControls) menuPlannerControls.classList.remove('has-saved-menus');
            if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
        }
    }

    // Favorites specific UI
    if (currentViewMode === 'favorites') {
        if (isLoggedIn) {
            displayUserFavorites();
        } else {
             if (favoriteRecipesDisplay) favoriteRecipesDisplay.innerHTML = '';
             displayFavoritesMessage("Please log in to see your favorite recipes.", "info");
        }
    }
    if (favoritesButton) favoritesButton.disabled = !supabaseClient;
}


async function handleLoginSubmit(event: Event) {
    event.preventDefault();
    if (!supabaseClient || !loginEmailInput || !loginPasswordInput || !loginSubmitButton || !loginMessage) return;

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    loginSubmitButton.disabled = true;
    clearModalMessage(loginMessage);

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            displayModalMessage(loginMessage, error.message, 'error');
            console.error('Login error:', error.message);
        } else if (data.user) {
            console.log('Login successful:', data.user);
            closeModal(loginModal);
        } else {
             displayModalMessage(loginMessage, 'Login failed. Please try again.', 'error');
        }
    } catch (e: any) {
        displayModalMessage(loginMessage, 'An unexpected error occurred during login.', 'error');
        console.error('Unexpected login error:', e.message);
    } finally {
        loginSubmitButton.disabled = false;
    }
}

async function handleSignupSubmit(event: Event) {
    event.preventDefault();
    if (!supabaseClient || !signupEmailInput || !signupPasswordInput || !signupSubmitButton || !signupMessage) return;

    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    signupSubmitButton.disabled = true;
    clearModalMessage(signupMessage);

    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });

        console.log('Supabase signup response data:', data);
        if (error) {
            console.error('Supabase signup error object:', error);
            displayModalMessage(signupMessage, error.message, 'error');
        } else if (data.session && data.user) {
            displayModalMessage(signupMessage, 'Signup successful! You are now logged in.', 'success');
            setTimeout(() => {
                if (signupModal.classList.contains('is-open')) {
                    closeModal(signupModal);
                }
            }, 2000);
        } else if (data.user) {
            displayModalMessage(signupMessage, 'Signup successful! Please check your email to verify your account before you can log in.', 'success');
        } else {
            displayModalMessage(signupMessage, 'Signup complete. Please check for a verification email or try logging in.', 'success');
        }
    } catch (e: any) {
        displayModalMessage(signupMessage, 'An unexpected error occurred during signup.', 'error');
        console.error('Unexpected signup error:', e);
    } finally {
        signupSubmitButton.disabled = false;
    }
}

async function handleLogout() {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert(`Logout failed: ${error.message}`);
            console.error('Logout error:', error.message);
        } else {
            console.log('Logout successful');
            currentWeeklyMenuData = null;
            currentGroceryListData = null;
        }
    } catch (e: any) {
        alert(`An unexpected error occurred during logout: ${e.message}`);
        console.error('Unexpected logout error:', e.message);
    }
}

function setupModalEventListeners() {
    if (!loginModal || !signupModal) return;

    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            closeModal(loginModal);
            closeModal(signupModal);
        });
    });

    const modalOverlays = document.querySelectorAll('.modal-overlay');
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', () => {
            closeModal(loginModal);
            closeModal(signupModal);
        });
    });

    if (goToSignupButton) {
        goToSignupButton.addEventListener('click', () => {
            closeModal(loginModal);
            openModal(signupModal);
        });
    }
    if (goToLoginButton) {
        goToLoginButton.addEventListener('click', () => {
            closeModal(signupModal);
            openModal(loginModal);
        });
    }

    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);
}


async function checkInitialAuthState() {
    if (!supabaseClient) {
      updateAuthUI(null);
      if (authButton) authButton.disabled = true;
      if(saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
      if(savedMenusDropdown) savedMenusDropdown.style.display = 'none';
      if(favoritesButton) favoritesButton.disabled = true;
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
        if (!session?.user) {
            if (currentViewMode === 'menuPlanner' && menuPlannerControls) {
                 if (saveCurrentMenuButton) saveCurrentMenuButton.style.display = 'none';
                 if (savedMenusDropdown) savedMenusDropdown.style.display = 'none';
                 menuPlannerControls.classList.remove('has-saved-menus');
            } else if (currentViewMode === 'favorites' && favoriteRecipesDisplay) {
                favoriteRecipesDisplay.innerHTML = '';
                displayFavoritesMessage("Please log in to see your favorite recipes.", "info");
            }
        }
    });
}


// --- Event Listeners & Initial Setup ---
if (API_KEY) {
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
    if (startOverButton) startOverButton.addEventListener('click', () => {
        if (currentViewMode === 'recipes') {
            handleStartOver();
        } else if (currentViewMode === 'menuPlanner') {
            currentWeeklyMenuData = null;
            currentGroceryListData = null;
            if(weeklyMenuDisplay) weeklyMenuDisplay.innerHTML = '';
            if(groceryListDisplay) groceryListDisplay.innerHTML = '';
            displayMenuPlannerMessage(`Menu planner cleared. Ready to generate a new weekly menu!`);
        } else if (currentViewMode === 'favorites') {
             if(favoriteRecipesDisplay) favoriteRecipesDisplay.innerHTML = '';
             displayFavoritesMessage("Favorites cleared (locally). Refresh or log back in to see saved ones.", "info");
        }
    });

    if (usUnitsButton && metricUnitsButton) {
        usUnitsButton.addEventListener('click', () => handleUnitChange('us'));
        metricUnitsButton.addEventListener('click', () => handleUnitChange('metric'));
    }

    if (menuPlannerButton) menuPlannerButton.addEventListener('click', () => switchToView('menuPlanner'));
    if (favoritesButton) favoritesButton.addEventListener('click', () => switchToView('favorites'));

    if (backToRecipesButton) backToRecipesButton.addEventListener('click', () => switchToView('recipes'));
    if (backToRecipesFromFavoritesButton) backToRecipesFromFavoritesButton.addEventListener('click', () => switchToView('recipes'));

    if (generateWeeklyMenuButton) generateWeeklyMenuButton.addEventListener('click', handleGenerateWeeklyMenu);
    if (saveCurrentMenuButton) saveCurrentMenuButton.addEventListener('click', handleSaveCurrentMenu);
    if (savedMenusDropdown) savedMenusDropdown.addEventListener('change', handleLoadSavedMenu);

} else {
    const allAIFeatureButtons = [
        suggestButton, surpriseButton, generateWeeklyMenuButton, menuPlannerButton, favoritesButton
    ];
    allAIFeatureButtons.forEach(btn => { if(btn) btn.disabled = true; });
}

if (authButton) {
    authButton.addEventListener('click', () => {
        if (!supabaseClient) {
            alert("Database connection is not configured. Login is unavailable.");
            return;
        }
        if (currentUser) {
            handleLogout();
        } else {
            openModal(loginModal);
        }
    });
}

setupModalEventListeners();
checkInitialAuthState();

switchToView('recipes');


if (usUnitsButton && metricUnitsButton && API_KEY) {
    const isUsSystem = currentUnitSystem === 'us';
    usUnitsButton.classList.toggle('active', isUsSystem);
    usUnitsButton.setAttribute('aria-pressed', String(isUsSystem));
    metricUnitsButton.classList.toggle('active', !isUsSystem);
    metricUnitsButton.setAttribute('aria-pressed', String(!isUsSystem));
}
// End of Sousie's script!
