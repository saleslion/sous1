/**
 * recipe-api.ts - Integration with TheMealDB free recipe database
 */

// TheMealDB API Configuration
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// Recipe interfaces for type safety
export interface MealDBRecipe {
    idMeal: string;
    strMeal: string;
    strDrinkAlternate?: string;
    strCategory: string;
    strArea: string;
    strInstructions: string;
    strMealThumb: string;
    strTags?: string;
    strYoutube?: string;
    strIngredient1?: string;
    strIngredient2?: string;
    strIngredient3?: string;
    strIngredient4?: string;
    strIngredient5?: string;
    strIngredient6?: string;
    strIngredient7?: string;
    strIngredient8?: string;
    strIngredient9?: string;
    strIngredient10?: string;
    strIngredient11?: string;
    strIngredient12?: string;
    strIngredient13?: string;
    strIngredient14?: string;
    strIngredient15?: string;
    strIngredient16?: string;
    strIngredient17?: string;
    strIngredient18?: string;
    strIngredient19?: string;
    strIngredient20?: string;
    strMeasure1?: string;
    strMeasure2?: string;
    strMeasure3?: string;
    strMeasure4?: string;
    strMeasure5?: string;
    strMeasure6?: string;
    strMeasure7?: string;
    strMeasure8?: string;
    strMeasure9?: string;
    strMeasure10?: string;
    strMeasure11?: string;
    strMeasure12?: string;
    strMeasure13?: string;
    strMeasure14?: string;
    strMeasure15?: string;
    strMeasure16?: string;
    strMeasure17?: string;
    strMeasure18?: string;
    strMeasure19?: string;
    strMeasure20?: string;
    strSource?: string;
    strImageSource?: string;
    strCreativeCommonsConfirmed?: string;
    dateModified?: string;
}

export interface SousieRecipe {
    name: string;
    description: string;
    anecdote: string;
    chefTip: string;
    ingredients: string[];
    instructions: string[];
    image?: string;
    source: 'themealdb' | 'ai_generated';
    sourceUrl?: string;
    category?: string;
    cuisine?: string;
    tags?: string[];
}

export interface MealPairing {
    mealTitle: string;
    mainRecipe: SousieRecipe;
    sideRecipe: SousieRecipe;
}

// Helper function to convert MealDB recipe to Sousie format
function convertMealDBToSousie(meal: MealDBRecipe): SousieRecipe {
    // Extract ingredients and measurements
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}` as keyof MealDBRecipe] as string;
        const measure = meal[`strMeasure${i}` as keyof MealDBRecipe] as string;
        
        if (ingredient && ingredient.trim()) {
            const ingredientText = measure && measure.trim() 
                ? `${measure.trim()} ${ingredient.trim()}`
                : ingredient.trim();
            ingredients.push(ingredientText);
        }
    }

    // Convert instructions to array (split by periods or line breaks)
    const instructions = meal.strInstructions
        .split(/\.\s+|\r?\n/)
        .filter(step => step.trim().length > 10)
        .map((step, index) => `${index + 1}. ${step.trim()}`)
        .slice(0, 8); // Limit to 8 steps for consistency

    // Generate description and anecdote
    const description = `A delicious ${meal.strArea} ${meal.strCategory.toLowerCase()} dish that brings authentic flavors to your kitchen.`;
    const anecdote = `This traditional ${meal.strArea} recipe is a beloved ${meal.strCategory.toLowerCase()} that has been enjoyed for generations.`;
    const chefTip = `For best results, take your time with the preparation and let the flavors develop naturally.`;

    return {
        name: meal.strMeal,
        description,
        anecdote,
        chefTip,
        ingredients,
        instructions,
        image: meal.strMealThumb,
        source: 'themealdb',
        sourceUrl: meal.strSource,
        category: meal.strCategory,
        cuisine: meal.strArea,
        tags: meal.strTags ? meal.strTags.split(',').map(tag => tag.trim()) : []
    };
}

// Search recipes by ingredient
export async function searchRecipesByIngredient(ingredient: string): Promise<SousieRecipe[]> {
    try {
        console.log(`🔍 Searching TheMealDB for ingredient: ${ingredient}`);
        const response = await fetch(`${MEALDB_BASE_URL}/filter.php?i=${encodeURIComponent(ingredient)}`);
        
        if (!response.ok) {
            throw new Error(`TheMealDB API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.meals) {
            console.log(`No recipes found for ingredient: ${ingredient}`);
            return [];
        }

        // Get full recipe details for each meal (TheMealDB filter only returns basic info)
        const detailedRecipes: SousieRecipe[] = [];
        
        // Limit to first 5 recipes to avoid too many API calls
        const mealsToFetch = data.meals.slice(0, 5);
        
        for (const meal of mealsToFetch) {
            try {
                const detailResponse = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${meal.idMeal}`);
                const detailData = await detailResponse.json();
                
                if (detailData.meals && detailData.meals[0]) {
                    const sousieRecipe = convertMealDBToSousie(detailData.meals[0]);
                    detailedRecipes.push(sousieRecipe);
                }
            } catch (error) {
                console.error(`Error fetching details for meal ${meal.idMeal}:`, error);
            }
        }

        console.log(`✅ Found ${detailedRecipes.length} recipes from TheMealDB`);
        return detailedRecipes;

    } catch (error) {
        console.error('Error searching TheMealDB:', error);
        return [];
    }
}

// Get random recipes
export async function getRandomRecipes(count: number = 3): Promise<SousieRecipe[]> {
    try {
        console.log(`🎲 Getting ${count} random recipes from TheMealDB`);
        const recipes: SousieRecipe[] = [];

        for (let i = 0; i < count; i++) {
            try {
                const response = await fetch(`${MEALDB_BASE_URL}/random.php`);
                const data = await response.json();
                
                if (data.meals && data.meals[0]) {
                    const sousieRecipe = convertMealDBToSousie(data.meals[0]);
                    recipes.push(sousieRecipe);
                }
            } catch (error) {
                console.error(`Error fetching random recipe ${i + 1}:`, error);
            }
        }

        console.log(`✅ Got ${recipes.length} random recipes from TheMealDB`);
        return recipes;

    } catch (error) {
        console.error('Error getting random recipes from TheMealDB:', error);
        return [];
    }
}

// Search recipes by multiple ingredients
export async function searchRecipesByIngredients(ingredients: string[]): Promise<SousieRecipe[]> {
    if (ingredients.length === 0) return [];

    // For multiple ingredients, search by the first ingredient and filter results
    const primaryIngredient = ingredients[0];
    const allRecipes = await searchRecipesByIngredient(primaryIngredient);
    
    // Filter recipes that contain more of the requested ingredients
    const filteredRecipes = allRecipes.filter(recipe => {
        const recipeIngredients = recipe.ingredients.join(' ').toLowerCase();
        const matchCount = ingredients.filter(ing => 
            recipeIngredients.includes(ing.toLowerCase())
        ).length;
        
        // Return recipes that have at least 2 of the requested ingredients
        return matchCount >= Math.min(2, ingredients.length);
    });

    return filteredRecipes.length > 0 ? filteredRecipes : allRecipes.slice(0, 3);
}

// Create meal pairings from database recipes
export async function createMealPairingsFromDB(ingredients: string[]): Promise<MealPairing[]> {
    try {
        console.log('🍽️ Creating meal pairings from TheMealDB...');
        
        // Get recipes based on ingredients
        let mainRecipes: SousieRecipe[] = [];
        
        if (ingredients.length > 0) {
            mainRecipes = await searchRecipesByIngredients(ingredients);
        } else {
            // If no ingredients specified, get random recipes
            mainRecipes = await getRandomRecipes(3);
        }

        if (mainRecipes.length === 0) {
            return [];
        }

        // Get random recipes for sides/desserts
        const sideRecipes = await getRandomRecipes(Math.max(3, mainRecipes.length));
        
        // Create pairings
        const pairings: MealPairing[] = [];
        
        for (let i = 0; i < Math.min(mainRecipes.length, 3); i++) {
            const mainRecipe = mainRecipes[i];
            const sideRecipe = sideRecipes[i] || sideRecipes[0]; // Fallback to first side if not enough
            
            const mealTitle = `${mainRecipe.cuisine} ${mainRecipe.category} Experience`;
            
            pairings.push({
                mealTitle,
                mainRecipe,
                sideRecipe
            });
        }

        console.log(`✅ Created ${pairings.length} meal pairings from TheMealDB`);
        return pairings;

    } catch (error) {
        console.error('Error creating meal pairings from TheMealDB:', error);
        return [];
    }
}