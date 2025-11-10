import { EMOTIONAL_CATEGORIES } from '../constants.js';

/**
 * Get the emoji for a given category name
 * @param {string} categoryName - The category name (e.g., "Happy", "Angry")
 * @returns {string} The emoji for that category, or empty string if not found
 */
export function getEmojiForCategory(categoryName) {
  if (!categoryName) return '';
  const category = EMOTIONAL_CATEGORIES.find(cat => cat.category === categoryName);
  return category ? category.emoji : '';
}

/**
 * Get all available categories with their emojis for filtering
 * @returns {Array} Array of {category, emoji} objects
 */
export function getAllCategories() {
  return EMOTIONAL_CATEGORIES.map(cat => ({
    category: cat.category,
    emoji: cat.emoji
  }));
}

