import { tool } from "ai";
import { z } from "zod";
import type { PersonaMeta } from "@/lib/personas";

export interface YouTubeResult {
  id: string;
  type: "video" | "playlist";
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

// Handle -> allowed channels per persona. This is the actual security boundary —
// everything downstream filters against resolved channelIds derived from this list.
const PERSONA_CHANNELS: Record<string, string[]> = {
  hitesh: ["chaiaurcode", "HiteshCodeLab"],
  piyush: ["piyushgargdev"],
};

const channelIdCache = new Map<string, { id: string; expires: number }>();
const CHANNEL_ID_TTL_MS = 24 * 60 * 60 * 1000;
const searchCache = new Map<string, { expires: number; results: YouTubeResult[] }>();
const SEARCH_TTL_MS = 60 * 60 * 1000;

async function resolveChannelId(handle: string, apiKey: string): Promise<string | null> {
  const cached = channelIdCache.get(handle);
  if (cached && cached.expires > Date.now()) return cached.id;

  const params = new URLSearchParams({ part: "id", forHandle: handle, key: apiKey });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  const id: string | undefined = data.items?.[0]?.id;
  if (!id) return null;

  channelIdCache.set(handle, { id, expires: Date.now() + CHANNEL_ID_TTL_MS });
  return id;
}

async function searchWithinChannel(
  channelId: string,
  query: string,
  type: "video" | "playlist",
  apiKey: string,
): Promise<YouTubeResult[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type,
    channelId,
    maxResults: "4",
    safeSearch: "strict",
    order: "relevance",
    key: apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  return (data.items ?? [])
    // Defense in depth: even though channelId already scopes the query,
    // don't trust it blindly — drop anything that doesn't match on the way out.
    .filter((item: any) => item.snippet.channelId === channelId)
    .map((item: any) => ({
      id: item.id.videoId ?? item.id.playlistId ?? "",
      type,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? "",
      url:
        type === "video"
          ? `https://www.youtube.com/watch?v=${item.id.videoId}`
          : `https://www.youtube.com/playlist?list=${item.id.playlistId}`,
    }));
}

// Factory: bound to a specific persona server-side, so the model never gets
// to choose which channels are searched — it only ever supplies the query.
export function createYoutubeSearchTool(personaId: string) {
  const handles = PERSONA_CHANNELS[personaId] ?? [];

  return tool({
    description:
      "Search YouTube for real videos or playlists from this persona's own channel(s) only. Use whenever the user asks where/how to learn something, wants a tutorial, course, or roadmap. Never invent titles from memory — always call this.",
    inputSchema: z.object({
      query: z.string().describe("Search query, e.g. 'JavaScript full course for beginners'"),
      type: z.enum(["video", "playlist"]).default("video"),
    }),
    execute: async ({ query, type }) => {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey || handles.length === 0) {
        return { error: "YouTube search isn't configured for this persona right now." };
      }

      const cacheKey = `${personaId}:${type}:${query.toLowerCase().trim()}`;
      const cached = searchCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return { results: cached.results };

      const channelIds = (
        await Promise.all(handles.map((h) => resolveChannelId(h, apiKey)))
      ).filter((id): id is string => Boolean(id));

      if (channelIds.length === 0) return { error: "Couldn't resolve this persona's channel." };

      const perChannel = await Promise.all(
        channelIds.map((id) => searchWithinChannel(id, query, type, apiKey)),
      );
      const results = perChannel.flat().slice(0, 4);

      searchCache.set(cacheKey, { results, expires: Date.now() + SEARCH_TTL_MS });
      return { results };
    },
  });
}