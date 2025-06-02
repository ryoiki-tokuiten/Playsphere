// List of languages with their standard names
// Source: ISO 639-1 language codes and common names
export const standardLanguages = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese',
  'Azerbaijani', 'Bangla', 'Basque', 'Belarusian', 'Bengali', 'Bhojpuri',
  'Bosnian', 'Bulgarian', 'Burmese', 'Catalan', 'Cebuano', 'Chinese',
  'Croatian', 'Czech', 'Danish', 'Dutch', 'English', 'Estonian',
  'Filipino', 'Finnish', 'French', 'Galician', 'Georgian', 'German',
  'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hebrew', 'Hindi',
  'Hungarian', 'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian',
  'Japanese', 'Javanese', 'Kannada', 'Kazakh', 'Khmer', 'Korean',
  'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lithuanian',
  'Macedonian', 'Maithili', 'Malay', 'Malayalam', 'Maltese', 'Mandarin',
  'Marathi', 'Mongolian', 'Nepali', 'Norwegian', 'Odia', 'Pashto',
  'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Romanian', 'Russian',
  'Sanskrit', 'Serbian', 'Sindhi', 'Sinhala', 'Slovak', 'Slovenian',
  'Somali', 'Spanish', 'Swahili', 'Swedish', 'Tagalog', 'Tamil',
  'Telugu', 'Thai', 'Turkish', 'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese', 'Welsh', 'Yoruba', 'Zulu'
];

// Function to normalize text for comparison
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFKD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
};

// Function to calculate Levenshtein distance between two strings
const levenshteinDistance = (str1: string, str2: string): number => {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return track[str2.length][str1.length];
};

// Function to find the closest matching standard language
export const findClosestLanguage = (input: string): string | null => {
  if (!input) return null;

  const normalizedInput = normalizeText(input);
  
  // First try exact match after normalization
  const exactMatch = standardLanguages.find(
    lang => normalizeText(lang) === normalizedInput
  );
  if (exactMatch) return exactMatch;

  // If no exact match, find closest match using Levenshtein distance
  let closestMatch = null;
  let minDistance = Infinity;
  let minDistanceThreshold = 3; // Maximum allowed distance for a match

  for (const lang of standardLanguages) {
    const distance = levenshteinDistance(normalizedInput, normalizeText(lang));
    if (distance < minDistance && distance <= minDistanceThreshold) {
      minDistance = distance;
      closestMatch = lang;
    }
  }

  return closestMatch;
};

// Function to get language suggestions based on input
export const getLanguageSuggestions = (input: string): string[] => {
  if (!input) return [];
  
  const normalizedInput = normalizeText(input);
  return standardLanguages
    .filter(lang => normalizeText(lang).includes(normalizedInput))
    .slice(0, 5); // Return top 5 suggestions
}; 