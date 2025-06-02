// Ideas API types
import { getApiUrl } from "./api-config";

export interface Idea {
  id: number;
  gameId: number;
  gameName: string;
  gameContact: string | null;
  title: string;
  description: string;
  votes: number;
  hasVoted: boolean;
  creatorUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeasResponse {
  ideas: Idea[];
  total: number;
  page: number;
  totalPages: number;
}

// Ideas API functions
export async function getIdeas(page = 1, limit = 10): Promise<IdeasResponse> {
  const response = await fetch(getApiUrl(`/api/ideas?page=${page}&limit=${limit}`), {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch ideas');
  }

  return response.json();
}

export async function createIdea(data: {
  gameId: number;
  title: string;
  description: string;
}): Promise<Idea> {
  const response = await fetch(getApiUrl('/api/ideas'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create idea');
  }

  return response.json();
}

export async function voteForIdea(ideaId: number): Promise<Idea> {
  const response = await fetch(getApiUrl(`/api/ideas/${ideaId}/vote`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to vote for idea');
  }

  return response.json();
}

export async function deleteIdea(id: number): Promise<void> {
  const response = await fetch(getApiUrl(`/api/ideas/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete idea');
  }
}