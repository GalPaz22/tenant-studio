/** What the production search returns right now for one query. */
export async function liveSearch(tenant, query) {
    const response = await fetch(new URL("/search", process.env.SEARCH_SERVICE_URL || "https://api.semantix-ai.com"), {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": tenant.apiKey, "x-semantix-preview": "dashboard" },
        body: JSON.stringify({ query: query.trim(), modern: true, limit: 30 }), signal: AbortSignal.timeout(60000), redirect: "error",
    });
    if (!response.ok)
        throw new Error(`Search service returned ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.products ?? [];
}
