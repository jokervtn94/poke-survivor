const CACHE_TTL = 24 * 60 * 60 * 1000;
const REFERENCE_CACHE_KEY = "psba_reference_html_v1";
const COMMUNITY_INDEX_CACHE_KEY = "psba_community_build_index_v1";
const COMMUNITY_PAGES_CACHE_KEY = "psba_community_build_pages_v1";
const TM_COMPATIBILITY_CACHE_KEY = "psba_tm_compatibility_v1";
const COMMUNITY_PAGE_CACHE_LIMIT = 12;
const TM_COMPATIBILITY_URL = "https://raw.githubusercontent.com/JPTER78/pokesurvivor/d567c6da88e4ef66634ab54a01b5a3607501e03a/js/data/tms.js";
const SOURCES = {
  pokedex: "https://pokesurvivor.com/en/pokedex/",
  moves: "https://pokesurvivor.com/en/moves/",
  communityBuilds: "https://pokesurvivors.org/builds/"
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let request;
  if (message?.type === "psba:get-reference-html") {
    request = getReferenceHtml();
  } else if (message?.type === "psba:get-community-build-index") {
    request = getCommunityBuildIndex();
  } else if (message?.type === "psba:get-community-build-page") {
    request = getCommunityBuildPage(message.slug);
  } else if (message?.type === "psba:get-tm-compatibility") {
    request = getTmCompatibility();
  } else {
    return;
  }

  request
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error?.message || "Could not load the reference." }));
  return true;
});

async function getReferenceHtml() {
  const stored = await chrome.storage.local.get(REFERENCE_CACHE_KEY);
  const cached = stored[REFERENCE_CACHE_KEY];
  if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.pokedex && cached.moves) {
    return { pokedex: cached.pokedex, moves: cached.moves, cached: true };
  }

  const [pokedexResponse, movesResponse] = await Promise.all([
    fetch(SOURCES.pokedex, { credentials: "omit", cache: "no-cache" }),
    fetch(SOURCES.moves, { credentials: "omit", cache: "no-cache" })
  ]);
  if (!pokedexResponse.ok || !movesResponse.ok) {
    throw new Error("The official PokéSurvivor reference pages are unavailable right now.");
  }

  const [pokedex, moves] = await Promise.all([pokedexResponse.text(), movesResponse.text()]);
  if (!pokedex.includes('id="p1"') || !moves.includes("<table")) {
    throw new Error("The official reference pages changed format.");
  }

  const result = { pokedex, moves, cached: false };
  await chrome.storage.local.set({ [REFERENCE_CACHE_KEY]: { ...result, savedAt: Date.now() } });
  return result;
}

async function getCommunityBuildIndex() {
  const stored = await chrome.storage.local.get(COMMUNITY_INDEX_CACHE_KEY);
  const cached = stored[COMMUNITY_INDEX_CACHE_KEY];
  if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.html?.includes("/builds/")) {
    return { html: cached.html, url: SOURCES.communityBuilds, cached: true };
  }

  const response = await fetch(SOURCES.communityBuilds, { credentials: "omit", cache: "no-cache" });
  if (!response.ok) throw new Error("Community build index is unavailable right now.");
  const html = await response.text();
  if (!html.includes("/builds/") || !html.includes("Pok") || !html.includes("Build")) {
    throw new Error("Community build index changed format.");
  }
  await chrome.storage.local.set({
    [COMMUNITY_INDEX_CACHE_KEY]: { html, savedAt: Date.now() }
  });
  return { html, url: SOURCES.communityBuilds, cached: false };
}

async function getCommunityBuildPage(rawSlug) {
  const slug = String(rawSlug || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error("Invalid community build reference.");
  }

  const stored = await chrome.storage.local.get(COMMUNITY_PAGES_CACHE_KEY);
  const pages = stored[COMMUNITY_PAGES_CACHE_KEY] && typeof stored[COMMUNITY_PAGES_CACHE_KEY] === "object"
    ? stored[COMMUNITY_PAGES_CACHE_KEY]
    : {};
  const cached = pages[slug];
  const url = SOURCES.communityBuilds + encodeURIComponent(slug) + "/";
  if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.html?.includes("<table")) {
    return { html: cached.html, url, cached: true };
  }

  const response = await fetch(url, { credentials: "omit", cache: "no-cache" });
  if (!response.ok) throw new Error("No community build page was found for this Pokémon.");
  const html = await response.text();
  if (!html.includes("<table") || !html.toLowerCase().includes("build")) {
    throw new Error("Community build page changed format.");
  }

  pages[slug] = { html, savedAt: Date.now() };
  const keep = Object.entries(pages)
    .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
    .slice(0, COMMUNITY_PAGE_CACHE_LIMIT);
  await chrome.storage.local.set({ [COMMUNITY_PAGES_CACHE_KEY]: Object.fromEntries(keep) });
  return { html, url, cached: false };
}

async function getTmCompatibility() {
  const stored = await chrome.storage.local.get(TM_COMPATIBILITY_CACHE_KEY);
  const cached = stored[TM_COMPATIBILITY_CACHE_KEY];
  if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.script?.includes("TM_MOVES")) {
    return { script: cached.script, url: TM_COMPATIBILITY_URL, cached: true };
  }

  const response = await fetch(TM_COMPATIBILITY_URL, { credentials: "omit", cache: "no-cache" });
  if (!response.ok) throw new Error("TM compatibility reference is unavailable right now.");
  const script = await response.text();
  if (!script.includes("TM_MOVES") || !script.includes("G.TM_MOVES")) {
    throw new Error("TM compatibility reference changed format.");
  }
  await chrome.storage.local.set({ [TM_COMPATIBILITY_CACHE_KEY]: { script, savedAt: Date.now() } });
  return { script, url: TM_COMPATIBILITY_URL, cached: false };
}
