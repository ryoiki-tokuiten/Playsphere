import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  urlOrOptions: string | { url: string; method: string; headers?: Record<string, string>; body?: any },
  options?: RequestInit
): Promise<any> {
  let url: string;
  let requestOptions: RequestInit;

  if (typeof urlOrOptions === 'string') {
    url = getApiUrl(urlOrOptions);
    requestOptions = options || {};
  } else {
    url = getApiUrl(urlOrOptions.url);
    requestOptions = {
      method: urlOrOptions.method,
      headers: urlOrOptions.headers || {},
      body: urlOrOptions.body ? (typeof urlOrOptions.body === 'string' ? urlOrOptions.body : JSON.stringify(urlOrOptions.body)) : undefined,
      ...options
    };
  }

  const res = await fetch(url, {
    ...requestOptions,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = getApiUrl(queryKey[0] as string);
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
