// server/routes/videos.ts
// API endpoint for fetching game-related videos from YouTube and Twitch

import express from 'express';
import { google } from 'googleapis';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import dotenv from 'dotenv';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  platform: 'youtube' | 'twitch';
  url: string;
}

dotenv.config();

const router = express.Router();

// Initialize YouTube API
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Initialize Twitch API (commented out until we have credentials)
/*
const twitchAuthProvider = new AppTokenAuthProvider(
  process.env.TWITCH_CLIENT_ID!,
  process.env.TWITCH_CLIENT_SECRET!
);
const twitchClient = new ApiClient({ authProvider: twitchAuthProvider });
*/

// Helper function to get videos from YouTube
const getYouTubeVideos = async (gameName: string): Promise<Video[]> => {
  console.log(`Starting YouTube video search for: ${gameName}`);
  console.log(`Using YouTube API key: ${process.env.YOUTUBE_API_KEY?.slice(0, 10)}...`);
  
  // Get date from 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const searchParams = {
    part: ['snippet'],
    q: `${gameName} gameplay -shorts`,  // Exclude shorts from search query
    type: ['video'],
    order: 'date',
    publishedAfter: thirtyDaysAgo.toISOString(),
    maxResults: 8,  // Increased to 8 since we'll filter some out
    videoDuration: 'medium'  // Only medium length videos (4-20 mins)
  };

  console.log('YouTube search params:', searchParams);

  try {
    const response = await youtube.search.list(searchParams);
    console.log('YouTube API response:', JSON.stringify(response.data, null, 2));

    // Filter out any remaining shorts or very short videos based on title
    const videos = response.data.items
      ?.filter(item => {
        const title = item.snippet?.title?.toLowerCase() || '';
        return !title.includes('#shorts') && 
               !title.includes('#short') && 
               !title.includes('shorts') &&
               !title.includes('tiktok');
      })
      .map(item => ({
        id: item.id?.videoId ?? '',
        title: item.snippet?.title ?? '',
        thumbnail: item.snippet?.thumbnails?.high?.url ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        platform: 'youtube' as const,
        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`
      }))
      .slice(0, 6) ?? [];  // Limit to 6 videos after filtering

    console.log('Processed YouTube videos:', videos);
    return videos;
  } catch (error) {
    console.error('YouTube API error:', error);
    return [];
  }
};

// Helper function to get videos from Twitch (temporarily returning empty array)
async function getTwitchVideos(gameName: string) {
  return [];  // We're not using Twitch videos as requested
}

// GET /api/videos/:gameName
router.get('/:gameName', async (req, res) => {
  try {
    const { gameName } = req.params;
    console.log('Received request for game:', gameName);
    
    // Only fetch YouTube videos
    const videos = await getYouTubeVideos(gameName);

    console.log('Total videos being sent:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Error fetching videos' });
  }
});

export default router; 