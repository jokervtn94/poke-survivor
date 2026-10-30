const CACHE_KEY = "psba_reference_html_v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SOURCES = {
  pokedex: "https://pokesurvivor.com/en/pokedex/",
  moves: "https://pokesurvivor.com/en/moves/"
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "psba:get-reference-html") return;

  getReferenceHtml()
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error?.message || "Could not load game references." }));
  return true;
});

async function getReferenceHtml() {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cached = stored[CACHE_KEY];
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
  if (!pokedex.includes("id=\"p1\"") || !moves.includes("<table")) {
    throw new Error("The official reference pages changed format.");
  }

  const result = { pokedex, moves, cached: false };
  await chrome.storage.local.set({ [CACHE_KEY]: { ...result, savedAt: Date.now() } });
  return result;
}
