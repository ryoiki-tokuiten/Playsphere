/**
 * API configuration for different environments
 */

// Determine if we're in production (Netlify) or development
const isProduction = import.meta.env.PROD;

// Base API URL - in production, use Netlify functions
export const API_BASE_URL = isProduction 
  ? '/.netlify/functions' 
  : '/api';

// Transform a regular API path to the correct path based on environment
export function getApiUrl(path: string): string {
  // If already has the correct prefix, return as is
  if (isProduction && path.startsWith('/.netlify/functions')) {
    return path;
  }
  
  if (!isProduction && path.startsWith('/api')) {
    return path;
  }
  
  // Remove /api prefix if present when in production
  const cleanPath = path.startsWith('/api/') 
    ? path.substring(5) // Remove '/api/' prefix
    : path.startsWith('/api') 
      ? path.substring(4) // Remove '/api' prefix
      : path;
      
  return isProduction 
    ? `${API_BASE_URL}/${cleanPath}` 
    : path.startsWith('/') 
      ? path 
      : `/api/${path}`;
}
