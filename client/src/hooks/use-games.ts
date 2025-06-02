import { useQuery } from "@tanstack/react-query";

interface Game {
  id: number;
  name: string;
  description: string;
  coverImage: string;
}

async function getGames(): Promise<Game[]> {
  const response = await fetch("/api/games");
  if (!response.ok) {
    throw new Error("Failed to fetch games");
  }
  return response.json();
}

export function useGames() {
  return useQuery({
    queryKey: ["games"],
    queryFn: getGames,
  });
} 