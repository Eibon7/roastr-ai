import type { Platform, NormalizedComment, CommentPage } from "@roastr/shared";

type FetchCommentsParams = {
  platform: Platform;
  accessToken: string;
  accountId: string;
  userId: string;
  channelId: string;
  cursor: string | null;
};

/**
 * Fetch comments from YouTube Data API v3.
 * X adapter: stub for now (returns empty).
 */
export async function fetchComments(
  params: FetchCommentsParams,
): Promise<CommentPage> {
  if (params.platform === "youtube") {
    return fetchYouTubeComments(params);
  }
  if (params.platform === "x") {
    return fetchXComments(params);
  }
  return { comments: [], nextCursor: null, hasMore: false };
}

async function fetchYouTubeComments(
  params: FetchCommentsParams,
): Promise<CommentPage> {
  const { accessToken, accountId, userId, channelId, cursor } = params;
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("allThreadsRelatedToChannelId", channelId);
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("textFormat", "plainText");
  if (cursor) url.searchParams.set("pageToken", cursor);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube commentThreads failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet: {
        topLevelComment: {
          snippet: {
            authorDisplayName: string;
            authorChannelId?: { value?: string };
            textDisplay: string;
            publishedAt: string;
          };
        };
      };
    }>;
    nextPageToken?: string;
  };

  const comments: NormalizedComment[] = (json.items ?? []).map((item) => {
    const s = item.snippet.topLevelComment.snippet;
    return {
      id: item.id,
      platform: "youtube",
      accountId,
      userId,
      authorId: s.authorChannelId?.value ?? s.authorDisplayName,
      text: s.textDisplay,
      timestamp: s.publishedAt,
      metadata: {},
    };
  });

  return {
    comments,
    nextCursor: json.nextPageToken ?? null,
    hasMore: !!json.nextPageToken,
  };
}

async function fetchXComments(
  params: FetchCommentsParams,
): Promise<CommentPage> {
  const { accessToken, accountId, userId, channelId, cursor } = params;
  const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(channelId)}/mentions`);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "created_at,author_id,text");
  url.searchParams.set("user.fields", "id,username");
  url.searchParams.set("expansions", "author_id");
  if (cursor) url.searchParams.set("pagination_token", cursor);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Roastr/1.0",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X mentions failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      text: string;
      author_id?: string;
      created_at?: string;
    }>;
    includes?: { users?: Array<{ id: string; username?: string }> };
    meta?: { next_token?: string };
  };

  const comments: NormalizedComment[] = (json.data ?? []).map((item) => ({
    id: item.id,
    platform: "x",
    accountId,
    userId,
    authorId: item.author_id ?? "",
    text: item.text ?? "",
    timestamp: item.created_at ?? new Date().toISOString(),
    metadata: {},
  }));

  return {
    comments,
    nextCursor: json.meta?.next_token ?? null,
    hasMore: !!json.meta?.next_token,
  };
}
