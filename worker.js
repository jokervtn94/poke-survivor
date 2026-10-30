const CACHE_KEY = "psba_reference_html_v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const PARTNER_BUILD_CACHE_KEY = "psba_partner_build_html_v1";
const PARTNER_BUILD_CACHE_TTL = 24 * 60 * 60 * 1000;
const PARTNER_BUILD_SOURCE = "https://pokesurvivors.org/builds/";
const SOURCES = {
  pokedex: "https://pokesurvivor.com/en/pokedex/",
  moves: "https://pokesurvivor.com/en/moves/"
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "psba:get-partner-build") {
    getPartnerBuildHtml(message.slug)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error?.message || "Could not load the community Pokémon build." }));
    return true;
  }
  if (message?.type !== "psba:get-reference-html") return;

  getReferenceHtml()
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error?.message || "Could not load game references." }));
  return true;
});

async function getPartnerBuildHtml(slug) {
  const safeSlug = String(slug || "").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeSlug)) {
    throw new Error("Tên Pokémon không hợp lệ để tìm move set.");
  }

  const stored = await chrome.storage.local.get(PARTNER_BUILD_CACHE_KEY);
  const cached = stored[PARTNER_BUILD_CACHE_KEY];
  if (cached?.slug === safeSlug && cached.savedAt && Date.now() - cached.savedAt < PARTNER_BUILD_CACHE_TTL && cached.html) {
    return { html: cached.html, url: cached.url, cached: true };
  }

  const url = `${PARTNER_BUILD_SOURCE}${safeSlug}/`;
  const response = await fetch(url, { credentials: "omit", cache: "no-cache" });
  if (!response.ok) throw new Error(`Nguồn build trả về lỗi HTTP ${response.status}.`);
  const html = await response.text();
  if (!html.includes("Moves") || !html.includes("Level-up card priority")) {
    throw new Error("Trang build chưa có dữ liệu move set theo định dạng extension hỗ trợ.");
  }

  await chrome.storage.local.set({
    [PARTNER_BUILD_CACHE_KEY]: { slug: safeSlug, html, url, savedAt: Date.now() }
  });
  return { html, url, cached: false };
}

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
