/**
 * recipe-cache.ts - Recipe caching system for better performance and AI recipe inspiration
 */

import { SousieRecipe, MealPairing } from './recipe-api';

// Supabase client (will be imported from core)
let supabaseClient: any = null;

// Initialize cache with Supabase client
export function initializeRecipeCache(client: any) {
    supabaseClient = client;
}

// Generate a consistent hash from ingredients list
function generateIngredientsHash(ingredients: string[]): string {
    const sortedIngredients = ingredients
        .map(ing => ing.toLowerCase().trim())
        .filter(ing => ing.length > 0)
        .sort();
    
    // Simple hash function for client-side use
    let hash = 0;
    const str = sortedIngredients.join(',');
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

// Cache a recipe in the database
export async function cacheRecipe(recipe: SousieRecipe): Promise<boolean> {
    if (!supabaseClient) {
        console.warn('Recipe cache not initialized - Supabase client missing');
        return false;
    }

    try {
        const recipeIdentifier = recipe.source === 'themealdb' 
            ? `themealdb_${recipe.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
            : `ai_${generateIngredientsHash(recipe.ingredients)}_${Date.now()}`;

        const ingredientsHash = generateIngredientsHash(recipe.ingredients);

        const cacheData = {
            recipe_identifier: recipeIdentifier,
            recipe_name: recipe.name,
            recipe_data: recipe,
            source: recipe.source || 'ai_generated',
            source_id: recipe.sourceUrl ? new URL(recipe.sourceUrl).pathname.split('/').pop() : null,
            ingredients_hash: ingredientsHash,
            category: recipe.category,
            cuisine: recipe.cuisine,
            tags: recipe.tags || []
        };

        const { error } = await supabaseClient
            .from('recipe_cache')
            .upsert(cacheData, { onConflict: 'recipe_identifier' });

        if (error) {
            console.error('Error caching recipe:', error);
            return false;
        }

        console.log(`✅ Recipe "${recipe.name}" cached successfully`);
        return true;

    } catch (error) {
        console.error('Error caching recipe:', error);
        return false;
    }
}

// Search cached recipes by ingredients
export async function searchCachedRecipes(ingredients: string[], limit: number = 10): Promise<SousieRecipe[]> {
    if (!supabaseClient) {
        console.warn('Recipe cache not initialized - Supabase client missing');
        return [];
    }

    try {
        console.log(`🔍 Searching recipe cache for ingredients: ${ingredients.join(', ')}`);

        // First try exact ingredients hash match
        const ingredientsHash = generateIngredientsHash(ingredients);
        
        let { data: exactMatches, error: exactError } = await supabaseClient
            .from('recipe_cache')
            .select('*')
            .eq('ingredients_hash', ingredientsHash)
            .eq('is_active', true)
            .limit(limit);

        if (exactError) throw exactError;

        if (exactMatches && exactMatches.length > 0) {
            console.log(`✅ Found ${exactMatches.length} exact ingredient matches in cache`);
            
            // Update last_accessed for found recipes
            for (const match of exactMatches) {
                await supabaseClient.rpc('update_recipe_cache_access', { recipe_id: match.id });
            }
            
            return exactMatches.map((cached: any) => cached.recipe_data as SousieRecipe);
        }

        // If no exact matches, search by individual ingredients using JSONB contains
        const ingredientQueries = ingredients.map(ing => ing.toLowerCase().trim());
        
        let query = supabaseClient
            .from('recipe_cache')
            .select('*')
            .eq('is_active', true)
            .limit(limit);

        // Search for recipes that contain any of the ingredients in their JSON data
        for (const ingredient of ingredientQueries) {
            query = query.or(`recipe_data->'ingredients'->>'*'.ilike.%${ingredient}%`);
        }

        let { data: partialMatches, error: partialError } = await query;

        if (partialError) throw partialError;

        if (partialMatches && partialMatches.length > 0) {
            console.log(`✅ Found ${partialMatches.length} partial ingredient matches in cache`);
            
            // Update last_accessed for found recipes
            for (const match of partialMatches) {
                await supabaseClient.rpc('update_recipe_cache_access', { recipe_id: match.id });
            }
            
            return partialMatches.map((cached: any) => cached.recipe_data as SousieRecipe);
        }

        console.log('No cached recipes found for ingredients');
        return [];

    } catch (error) {
        console.error('Error searching recipe cache:', error);
        return [];
    }
}

// Get random cached recipes
export async function getRandomCachedRecipes(limit: number = 5): Promise<SousieRecipe[]> {
    if (!supabaseClient) {
        console.warn('Recipe cache not initialized - Supabase client missing');
        return [];
    }

    try {
        console.log(`🎲 Getting ${limit} random cached recipes`);

        const { data, error } = await supabaseClient
            .from('recipe_cache')
            .select('*')
            .eq('is_active', true)
            .order('last_accessed', { ascending: false }) // Prefer recently accessed
            .limit(limit * 3); // Get more to randomize

        if (error) throw error;

        if (!data || data.length === 0) {
            console.log('No cached recipes available for random selection');
            return [];
        }

        // Randomly select from available recipes
        const shuffled = data.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, limit);

        // Update last_accessed for selected recipes
        for (const recipe of selected) {
            await supabaseClient.rpc('update_recipe_cache_access', { recipe_id: recipe.id });
        }

        console.log(`✅ Selected ${selected.length} random cached recipes`);
        return selected.map((cached: any) => cached.recipe_data as SousieRecipe);

    } catch (error) {
        console.error('Error getting random cached recipes:', error);
        return [];
    }
}

// Get recipes for AI inspiration (recent, diverse)
export async function getRecipesForAIInspiration(ingredients: string[], limit: number = 20): Promise<SousieRecipe[]> {
    if (!supabaseClient) {
        console.warn('Recipe cache not initialized - Supabase client missing');
        return [];
    }

    try {
        console.log(`🧠 Getting ${limit} recipes for AI inspiration`);

        // Get a mix of:
        // 1. Recipes with similar ingredients
        // 2. Popular recipes (recently accessed)
        // 3. Diverse cuisines and categories

        const { data, error } = await supabaseClient
            .from('recipe_cache')
            .select('*')
            .eq('is_active', true)
            .order('last_accessed', { ascending: false })
            .limit(limit);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.log('No cached recipes available for AI inspiration');
            return [];
        }

        console.log(`✅ Retrieved ${data.length} recipes for AI inspiration`);
        return data.map((cached: any) => cached.recipe_data as SousieRecipe);

    } catch (error) {
        console.error('Error getting recipes for AI inspiration:', error);
        return [];
    }
}

// Cache multiple recipes at once (for batch operations)
export async function cacheMultipleRecipes(recipes: SousieRecipe[]): Promise<number> {
    let successCount = 0;
    
    for (const recipe of recipes) {
        const success = await cacheRecipe(recipe);
        if (success) successCount++;
    }
    
    console.log(`✅ Cached ${successCount}/${recipes.length} recipes`);
    return successCount;
}

// Get cache statistics
export async function getCacheStats(): Promise<{total: number, bySource: Record<string, number>, recentlyAccessed: number}> {
    if (!supabaseClient) {
        return { total: 0, bySource: {}, recentlyAccessed: 0 };
    }

    try {
        // Total count
        const { count: total } = await supabaseClient
            .from('recipe_cache')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // Count by source
        const { data: sourceData } = await supabaseClient
            .from('recipe_cache')
            .select('source')
            .eq('is_active', true);

        const bySource: Record<string, number> = {};
        sourceData?.forEach((item: any) => {
            bySource[item.source] = (bySource[item.source] || 0) + 1;
        });

        // Recently accessed (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const { count: recentlyAccessed } = await supabaseClient
            .from('recipe_cache')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .gte('last_accessed', weekAgo.toISOString());

        return {
            total: total || 0,
            bySource,
            recentlyAccessed: recentlyAccessed || 0
        };

    } catch (error) {
        console.error('Error getting cache stats:', error);
        return { total: 0, bySource: {}, recentlyAccessed: 0 };
    }
}