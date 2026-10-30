(() => {
  "use strict";

  const hasGameScaffold = () => Boolean(document.querySelector("#game") && document.querySelector("#scr-levelup") && document.querySelector("#cards"));
  if (hasGameScaffold()) initialize();
  else {
    const startupObserver = new MutationObserver(() => {
      if (!hasGameScaffold()) return;
      startupObserver.disconnect();
      initialize();
    });
    startupObserver.observe(document.documentElement, { subtree: true, childList: true });
  }

  function initialize() {

  const STATE_KEY = "psba_player_state_v1";
  const MAX_MOVE_SLOTS = 4;
  const MAX_MOVES_WITH_BONDS = 16;
  const AUTO_PICK_DELAY_MS = 1250;
  const AUTO_PICK_RETRY_MS = 180;
  const AUTO_PICK_MAX_RETRIES = 16;
  const TM_COMPATIBILITY_REVIEW_DATE = "2026-10-22";
  const EVO_STATS = ["Power", "Vigor", "Reflexes", "Armor", "Synthesis", "Magnet", "Sprint"];
  const STRATEGIES = {
    balanced: "Cân bằng",
    evolve: "Ưu tiên tiến hóa",
    physical: "Thiên vật lý",
    special: "Thiên đặc biệt",
    survival: "Sinh tồn"
  };

  const state = {
    pokemon: "",
    manualPokemon: false,
    strategy: "balanced",
    autoPick: true,
    autoClaimMissions: true,
    targets: [],
    learnedMoves: [],
    fusedGroups: [],
    statPicks: [],
    tmBuildPokemon: "",
    lastLevel: 0
  };
  let pokemonData = [];
  let moveData = [];
  let lastAutoName = "";
  let isLevelUpVisible = false;
  let wasGameOver = false;
  let panelOpen = false;
  let cachedCandidates = [];
  let autoPickTimer = null;
  let autoPickSignature = "";
  let pendingAutoPickSignature = "";
  let lastTrackedSelectionSignature = "";
  let lastTrackedSelectionAt = 0;
  let missionCheckTimer = null;
  let missionClaimTimer = null;
  const missionClaimAttempts = new Map();
  let gameCoins = null;
  let tmOffers = [];
  let tmShopScannedAt = 0;
  let tmScanTimer = null;
  let ownedTms = [];
  let tmBagScannedAt = 0;
  let tmBagScanTimer = null;
  let tmCandidateMoveName = "";
  let tmCandidatePokemonFilter = "";
  let tmCompatibilityByMove = null;
  let communityBuild = null;
  let communityBuildRequestId = 0;

  const host = document.createElement("div");
  host.id = "psba-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <button id="psba-fab" class="fab" type="button" aria-label="Mở trợ lý build">PS</button>
    <aside id="psba-panel" class="panel" aria-label="PokéSurvivor Build Assistant">
      <header class="header">
        <div><div class="eyebrow">POKÉ SURVIVOR</div><strong>Build Assistant</strong></div>
        <button id="psba-minimize" class="icon-button" type="button" aria-label="Thu gọn">−</button>
      </header>
      <div class="body">
        <p id="psba-status" class="status">Đang đọc dữ liệu game…</p>
        <label for="psba-pokemon">Pokémon đang chơi</label>
        <div class="pokemon-row">
          <input id="psba-pokemon" list="psba-pokemon-list" placeholder="Ví dụ: Pikachu" autocomplete="off">
          <button id="psba-sync" class="quiet-button" type="button" title="Đọc Pokémon đang hiển thị ở menu game">Đồng bộ</button>
        </div>
        <datalist id="psba-pokemon-list"></datalist>
        <div id="psba-types" class="types"><span class="muted">Chưa nhận diện hệ</span></div>
        <p id="psba-partner-details" class="muted partner-details">Đang chờ thông tin Partner từ game.</p>

        <div class="section-title"><span>TM & PokéCoin</span><button id="psba-check-tms" class="text-button" type="button">Quét Shop</button></div>
        <div class="coin-row"><span>PokéCoin hiện có</span><strong id="psba-coin-balance">—</strong></div>
        <div class="tm-action-row"><button id="psba-scan-bag" class="quiet-button" type="button">Quét Túi TM</button><span id="psba-bag-status" class="muted">Chưa quét Túi.</span></div>
        <div id="psba-tm-inventory" class="tm-inventory"><p class="muted">Mở Túi trong menu game để đọc TM đang có.</p></div>
        <div class="tm-candidate-row">
          <select id="psba-tm-candidate-move" aria-label="Chọn TM trong Túi"></select>
          <input id="psba-tm-candidate-search" placeholder="Lọc Pokémon phù hợp" autocomplete="off">
        </div>
        <p id="psba-tm-candidate-status" class="muted auto-status">Quét Túi để tìm Pokémon tương thích với TM đang có.</p>
        <div id="psba-tm-candidates" class="tm-candidates"></div>
        <p id="psba-tm-status" class="muted auto-status">Mở Kecleon Shop từ menu chính để đọc 8 TM hôm nay.</p>
        <div id="psba-tm-recommendations" class="recommendations"><p class="muted">Gợi ý mua và build TM theo Partner sẽ hiển thị sau khi quét Shop.</p></div>
        <div class="section-title"><span>Đối chiếu build tham khảo</span><button id="psba-tm-use-partner" class="text-button" type="button">Dùng Partner</button></div>
        <div class="tm-target-row">
          <input id="psba-tm-target-pokemon" list="psba-pokemon-list" placeholder="Chọn Pokémon muốn build" autocomplete="off">
          <button id="psba-tm-check-build" class="quiet-button" type="button">So sánh</button>
        </div>
        <p id="psba-tm-build-status" class="muted auto-status">Chọn Pokémon để tải build tham khảo cộng đồng.</p>
        <div id="psba-tm-build-result" class="recommendations"><p class="muted">So sánh build với TM trong Túi và Shop sẽ hiện ở đây.</p></div>
        <div class="tm-source-links">
          <a href="https://pokesurvivors.org/builds/" target="_blank" rel="noopener noreferrer">Builds tham khảo · 966 Pokémon</a>
          <a href="https://pokemonsurvivorwiki.com/tm-compatibility/" target="_blank" rel="noopener noreferrer">Kiểm tra tương thích TM</a>
          <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3819633059" target="_blank" rel="noopener noreferrer">Guide cộng đồng & spreadsheet</a>
        </div>

        <label for="psba-strategy">Hướng build</label>
        <select id="psba-strategy">
          <option value="balanced">Cân bằng</option>
          <option value="evolve">Ưu tiên tiến hóa</option>
          <option value="physical">Thiên vật lý</option>
          <option value="special">Thiên đặc biệt</option>
          <option value="survival">Sinh tồn</option>
        </select>

        <div class="section-title"><span>Skill muốn nhắm tới</span><small>tùy chọn</small></div>
        <div class="target-row">
          <input id="psba-target-input" list="psba-move-list" placeholder="Tìm move để ưu tiên" autocomplete="off">
          <button id="psba-add-target" class="quiet-button" type="button">+</button>
        </div>
        <datalist id="psba-move-list"></datalist>
        <div id="psba-targets" class="chips empty">Chưa chọn skill mục tiêu.</div>

        <div class="section-title"><span>Đề xuất ở lần lên cấp này</span><small id="psba-level">chờ thẻ</small></div>
        <div id="psba-recommendations" class="recommendations"><p class="muted">Khi màn hình chọn thẻ xuất hiện, gợi ý sẽ hiện ở đây.</p></div>
        <label class="auto-pick-row"><span><input id="psba-auto-pick" type="checkbox"> Tự chọn thẻ điểm cao nhất</span></label>
        <p id="psba-auto-status" class="muted auto-status">Tự chọn thẻ hạng 1; nếu hòa hoặc chưa chấm được thì theo thứ tự game.</p>

        <div class="section-title"><span>Nhiệm vụ</span><button id="psba-check-missions" class="text-button" type="button">Kiểm tra</button></div>
        <label class="auto-pick-row"><span><input id="psba-auto-claim-missions" type="checkbox"> Tự nhận thưởng nhiệm vụ hoàn thành</span></label>
        <p id="psba-mission-status" class="muted auto-status">Mở Missions trong menu game để đồng bộ tiến độ.</p>

        <div class="section-title"><span>Skill đã học trong lượt</span><button id="psba-reset" class="text-button" type="button">Xóa lượt</button></div>
        <div id="psba-build" class="build-list"><p class="muted">Chưa ghi nhận lựa chọn nào.</p></div>
        <div class="owned-row">
          <input id="psba-known-move" list="psba-move-list" placeholder="Ghi nhận move khởi đầu / đã có" autocomplete="off">
          <input id="psba-known-level" class="known-level-input" type="number" min="1" max="5" value="1" aria-label="Cấp skill đã có">
          <button id="psba-add-known" class="quiet-button" type="button">Thêm</button>
        </div>
        <div class="section-title"><span>Gợi ý ghép Bond</span><small id="psba-bond-count">cần 2 skill</small></div>
        <div id="psba-fusions" class="recommendations"><p class="muted">Học thêm skill để xem các cặp kết hợp.</p></div>
        <p class="footnote">Extension tự ghi nhận thẻ bạn chọn. Tự chọn có thể tắt bất cứ lúc nào; gợi ý Bond là đánh giá chiến thuật, không phải công thức đặc biệt của game.</p>
      </div>
    </aside>`;
  document.documentElement.appendChild(host);

  const ui = {
    panel: shadow.querySelector("#psba-panel"),
    fab: shadow.querySelector("#psba-fab"),
    status: shadow.querySelector("#psba-status"),
    pokemon: shadow.querySelector("#psba-pokemon"),
    pokemonList: shadow.querySelector("#psba-pokemon-list"),
    types: shadow.querySelector("#psba-types"),
    partnerDetails: shadow.querySelector("#psba-partner-details"),
    coinBalance: shadow.querySelector("#psba-coin-balance"),
    tmStatus: shadow.querySelector("#psba-tm-status"),
    tmRecommendations: shadow.querySelector("#psba-tm-recommendations"),
    checkTms: shadow.querySelector("#psba-check-tms"),
    scanBag: shadow.querySelector("#psba-scan-bag"),
    bagStatus: shadow.querySelector("#psba-bag-status"),
    tmInventory: shadow.querySelector("#psba-tm-inventory"),
    tmCandidateMove: shadow.querySelector("#psba-tm-candidate-move"),
    tmCandidateSearch: shadow.querySelector("#psba-tm-candidate-search"),
    tmCandidateStatus: shadow.querySelector("#psba-tm-candidate-status"),
    tmCandidates: shadow.querySelector("#psba-tm-candidates"),
    tmBuildPokemon: shadow.querySelector("#psba-tm-target-pokemon"),
    checkTmBuild: shadow.querySelector("#psba-tm-check-build"),
    useCurrentPartner: shadow.querySelector("#psba-tm-use-partner"),
    tmBuildStatus: shadow.querySelector("#psba-tm-build-status"),
    tmBuildResult: shadow.querySelector("#psba-tm-build-result"),
    strategy: shadow.querySelector("#psba-strategy"),
    autoPick: shadow.querySelector("#psba-auto-pick"),
    autoStatus: shadow.querySelector("#psba-auto-status"),
    autoClaimMissions: shadow.querySelector("#psba-auto-claim-missions"),
    missionStatus: shadow.querySelector("#psba-mission-status"),
    checkMissions: shadow.querySelector("#psba-check-missions"),
    targetInput: shadow.querySelector("#psba-target-input"),
    knownMove: shadow.querySelector("#psba-known-move"),
    knownLevel: shadow.querySelector("#psba-known-level"),
    moveList: shadow.querySelector("#psba-move-list"),
    targets: shadow.querySelector("#psba-targets"),
    level: shadow.querySelector("#psba-level"),
    recommendations: shadow.querySelector("#psba-recommendations"),
    build: shadow.querySelector("#psba-build"),
    fusions: shadow.querySelector("#psba-fusions"),
    bondCount: shadow.querySelector("#psba-bond-count")
  };

  shadow.querySelector("#psba-minimize").addEventListener("click", () => setPanelOpen(false));
  ui.fab.addEventListener("click", () => setPanelOpen(true));
  ui.pokemon.addEventListener("change", onPokemonInput);
  ui.pokemon.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onPokemonInput();
      ui.pokemon.blur();
    }
  });
  shadow.querySelector("#psba-sync").addEventListener("click", syncPartnerFromGame);
  ui.strategy.addEventListener("change", () => {
    state.strategy = ui.strategy.value;
    persistState();
    refreshRecommendations();
    renderTmRecommendations();
  });
  ui.autoPick.addEventListener("change", () => {
    state.autoPick = ui.autoPick.checked;
    persistState();
    refreshRecommendations();
  });
  ui.autoClaimMissions.addEventListener("change", () => {
    state.autoClaimMissions = ui.autoClaimMissions.checked;
    persistState();
    queueMissionCheck(0);
  });
  ui.checkMissions.addEventListener("click", openMissionsFromGameMenu);
  ui.checkTms.addEventListener("click", openTmShopFromGameMenu);
  ui.scanBag.addEventListener("click", openBagFromGameMenu);
  ui.tmCandidateMove.addEventListener("change", () => {
    tmCandidateMoveName = ui.tmCandidateMove.value;
    renderTmCandidates();
  });
  ui.tmCandidateSearch.addEventListener("input", () => {
    tmCandidatePokemonFilter = ui.tmCandidateSearch.value;
    renderTmCandidates();
  });
  ui.checkTmBuild.addEventListener("click", loadCommunityBuildForSelected);
  ui.tmBuildPokemon.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadCommunityBuildForSelected();
    }
  });
  ui.tmBuildPokemon.addEventListener("input", () => {
    if (normalize(ui.tmBuildPokemon.value) !== normalize(state.tmBuildPokemon)) {
      communityBuild = null;
      ui.tmBuildStatus.textContent = "Nhấn So sánh để tải build cho Pokémon đã chọn.";
      renderCommunityBuild();
    }
  });
  ui.useCurrentPartner.addEventListener("click", () => {
    const partner = currentPartnerForTms();
    if (!partner) {
      ui.tmBuildStatus.textContent = "Chưa nhận diện Partner trong menu game.";
      return;
    }
    state.tmBuildPokemon = partner.name;
    ui.tmBuildPokemon.value = partner.name;
    persistState();
    loadCommunityBuildForSelected();
  });
  shadow.querySelector("#psba-add-target").addEventListener("click", addTarget);
  shadow.querySelector("#psba-add-known").addEventListener("click", addKnownMove);
  ui.knownMove.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addKnownMove();
    }
  });
  ui.targetInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTarget();
    }
  });
  shadow.querySelector("#psba-reset").addEventListener("click", resetRun);
  ui.autoPick.checked = state.autoPick;
  ui.autoClaimMissions.checked = state.autoClaimMissions;

  let gameRefreshTimer = null;
  let lastLevelUpPollFingerprint = "";
  let observedGameRoots = new Set();
  const gameRootSelector = "#game, #cards, #scr-levelup, #scr-over, #scr-goals, #goals-body, #scr-shop, #shop-body, #scr-bag, #bag-body, #coins, #menu-partner-name, #menu-partner-info, #res-name, #starter-info";
  const gameMutationTargetSelector = "#cards, #scr-levelup, #scr-over, #scr-goals, #goals-body, #scr-shop, #shop-body, #scr-bag, #bag-body, #coins, #menu-partner-name, #menu-partner-info, #res-name, #starter-info";
  const observedGameRootSelectors = ["#cards", "#scr-levelup", "#scr-over", "#scr-goals", "#goals-body", "#scr-shop", "#shop-body", "#scr-bag", "#bag-body", "#coins", "#menu-partner-name", "#menu-partner-info", "#res-name", "#starter-info"];
  document.addEventListener("click", onGameCardClick, true);
  document.addEventListener("keydown", onGameLevelUpKeydown, true);
  const observer = new MutationObserver((records) => {
    if (!records.some(isRelevantGameMutation)) return;
    refreshObservedGameRoots(observer);
    queueGameRefresh();
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });
  refreshObservedGameRoots(observer);

  function refreshObservedGameRoots(gameObserver) {
    const roots = new Set(observedGameRootSelectors.map((selector) => document.querySelector(selector)).filter(Boolean));
    if (roots.size === observedGameRoots.size && [...roots].every((root) => observedGameRoots.has(root))) return false;
    observedGameRoots = roots;
    gameObserver.disconnect();
    gameObserver.observe(document.documentElement, { subtree: true, childList: true });
    for (const element of roots) {
      gameObserver.observe(element, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "data-id", "data-move", "disabled", "aria-disabled"]
      });
    }
    return true;
  }

  function isRelevantGameMutation(record) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (target?.closest(gameMutationTargetSelector)) return true;
    if (record.type !== "childList") return false;
    for (const node of [...record.addedNodes, ...record.removedNodes]) {
      if (!(node instanceof Element)) continue;
      if (node.matches(gameRootSelector) || node.querySelector(gameRootSelector)) return true;
    }
    return false;
  }

  function queueGameRefresh() {
    if (gameRefreshTimer) return;
    gameRefreshTimer = setTimeout(() => {
      gameRefreshTimer = null;
      refreshGameState();
    }, 60);
  }

  function refreshGameState() {
    observePartnerName();
    updatePartnerDetails();
    updateCoinBalance();
    updateLevelUpState();
    updateGameOverState();
    queueMissionCheck();
    queueTmScan();
    queueBagScan();
  }

  const refreshAfterResume = () => {
    refreshObservedGameRoots(observer);
    refreshGameState();
    queueTmScan(250);
    queueBagScan(250);
    queueMissionCheck(250);
  };
  window.addEventListener("focus", refreshAfterResume);
  window.addEventListener("pageshow", refreshAfterResume);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAfterResume();
  });
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const rootsChanged = refreshObservedGameRoots(observer);
    const visible = isScreenVisible(document.querySelector("#scr-levelup"));
    const fingerprint = `${visible}:${visible ? cardSelectionSignature() : ""}`;
    if (!rootsChanged && fingerprint === lastLevelUpPollFingerprint && visible === isLevelUpVisible) return;
    lastLevelUpPollFingerprint = fingerprint;
    updateLevelUpState();
    updateGameOverState();
  }, 500);

  setPanelOpen(false);
  loadStoredState();
  loadReferenceData();
  observePartnerName();
  updatePartnerDetails();
  updateCoinBalance();
  updateLevelUpState();
  updateGameOverState();
  queueMissionCheck();
  queueTmScan();
  queueBagScan();

  function normalize(value) {
    return String(value || "")
      .replace(/♀/g, " female")
      .replace(/♂/g, " male")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function stateCopy() {
    return {
      pokemon: state.pokemon,
      manualPokemon: state.manualPokemon,
      strategy: state.strategy,
      autoPick: state.autoPick,
      autoClaimMissions: state.autoClaimMissions,
      targets: [...state.targets],
      learnedMoves: state.learnedMoves.map((move) => ({ ...move })),
      fusedGroups: state.fusedGroups.map((group) => [...group]),
      statPicks: [...state.statPicks],
      tmBuildPokemon: state.tmBuildPokemon,
      lastLevel: state.lastLevel
    };
  }

  async function loadStoredState() {
    try {
      const saved = await chrome.storage.local.get(STATE_KEY);
      const value = saved[STATE_KEY];
      if (value && typeof value === "object") {
        state.pokemon = String(value.pokemon || "");
        state.manualPokemon = Boolean(value.manualPokemon);
        state.strategy = Object.prototype.hasOwnProperty.call(STRATEGIES, value.strategy) ? value.strategy : "balanced";
        state.autoPick = value.autoPick === undefined ? true : Boolean(value.autoPick);
        state.autoClaimMissions = value.autoClaimMissions === undefined ? true : Boolean(value.autoClaimMissions);
        state.targets = Array.isArray(value.targets) ? value.targets.filter((item) => typeof item === "string") : [];
        state.learnedMoves = Array.isArray(value.learnedMoves) ? value.learnedMoves.filter((item) => item && typeof item.name === "string").slice(0, MAX_MOVES_WITH_BONDS) : [];
        state.fusedGroups = Array.isArray(value.fusedGroups)
          ? value.fusedGroups.map((group) => Array.isArray(group) ? group.filter((name) => typeof name === "string").slice(0, MAX_MOVE_SLOTS) : []).filter((group) => group.length >= 2).slice(0, MAX_MOVE_SLOTS)
          : [];
        state.statPicks = Array.isArray(value.statPicks) ? value.statPicks.filter((item) => typeof item === "string").slice(-12) : [];
        state.tmBuildPokemon = String(value.tmBuildPokemon || "");
        state.lastLevel = Number.isFinite(Number(value.lastLevel)) ? Number(value.lastLevel) : 0;
      }
      syncUiFromState();
      if (pokemonData.length && state.tmBuildPokemon) loadCommunityBuildForSelected();
    } catch (_error) {
      ui.status.textContent = "Không đọc được cài đặt đã lưu; trợ lý vẫn hoạt động trong phiên này.";
    }
  }

  function persistState() {
    chrome.storage.local.set({ [STATE_KEY]: stateCopy() }).catch(() => {});
  }

  async function loadReferenceData() {
    ui.status.textContent = "Đang tải Pokédex và bảng move chính thức…";
    try {
      const response = await chrome.runtime.sendMessage({ type: "psba:get-reference-html" });
      if (!response || response.error) throw new Error(response?.error || "Không lấy được dữ liệu tham khảo.");
      const parsed = parseReferencePages(response);
      pokemonData = parsed.pokemon;
      moveData = parsed.moves;
      populateLists();
      loadTmCompatibilityData();
      if (!state.tmBuildPokemon) {
        state.tmBuildPokemon = currentPartnerForTms()?.name || state.pokemon;
        persistState();
      }
      syncUiFromState();
      observePartnerName();
      updatePartnerDetails();
      updateCoinBalance();
      ui.status.textContent = `Đã nạp ${pokemonData.length} Pokémon và ${moveData.length} move từ trang chính thức.`;
      refreshRecommendations();
      if (isScreenVisible(document.querySelector("#scr-shop"))) scanTmShop();
      else renderTmRecommendations();
      if (state.tmBuildPokemon) loadCommunityBuildForSelected();
    } catch (_error) {
      ui.status.textContent = "Không tải được dữ liệu tham khảo. Có thể nhập Pokémon và vẫn xem được gợi ý cơ bản.";
      refreshRecommendations();
    }
  }

  function parseReferencePages(reference) {
    const parser = new DOMParser();
    const dexDocument = parser.parseFromString(reference.pokedex, "text/html");
    const movesDocument = parser.parseFromString(reference.moves, "text/html");
    const pokemon = Array.from(dexDocument.querySelectorAll('li[id^="p"]'))
      .filter((item) => /^p\d+$/.test(item.id))
      .map((item) => ({
        id: Number(item.id.slice(1)),
        name: item.querySelector(".nm")?.textContent.trim() || item.querySelector("img[alt]")?.alt || "",
        types: Array.from(item.querySelectorAll(".tys .ty"), (type) => type.textContent.trim()).filter(Boolean)
      }))
      .filter((item) => item.name);
    const moves = Array.from(movesDocument.querySelectorAll("table tbody tr"))
      .map((row) => {
        const cells = Array.from(row.cells);
        const evolutionText = cells[5]?.innerText.trim() || "";
        const evoStat = evolutionText.match(/with\s+([A-Za-z]+)/i)?.[1] || "";
        return {
          name: cells[0]?.innerText.trim() || "",
          type: cells[1]?.innerText.trim() || "",
          category: cells[2]?.innerText.trim() || "",
          kind: cells[3]?.innerText.trim() || "",
          description: cells[4]?.innerText.trim() || "",
          evolutionText,
          evoStat: EVO_STATS.find((stat) => normalize(stat) === normalize(evoStat)) || ""
        };
      })
      .filter((item) => item.name);
    return { pokemon, moves };
  }

  async function loadTmCompatibilityData() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "psba:get-tm-compatibility" });
      if (!response || response.error) throw new Error(response?.error || "Không tải được bảng tương thích TM.");
      const match = String(response.script || "").match(/G\.TM_MOVES\s*=\s*\{([\s\S]*?)\};/);
      if (!match) throw new Error("Bảng TM không đúng định dạng.");

      const compatibility = new Map();
      const entryPattern = /["']([^"']+)["']\s*:\s*\[([^\]]*)\]/g;
      let entry;
      while ((entry = entryPattern.exec(match[1]))) {
        const ids = entry[2].split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
        compatibility.set(entry[1].toLowerCase(), new Set(ids));
      }
      if (compatibility.size < 30) throw new Error("Bảng tương thích chưa đủ dữ liệu.");
      tmCompatibilityByMove = compatibility;
    } catch (_error) {
      tmCompatibilityByMove = null;
    }
    renderTmCandidates();
    renderCommunityBuild();
  }

  function moveSlug(move) {
    return normalize(move?.name || move).replace(/\s+/g, "-");
  }

  function tmCompatibilityFor(pokemon, move) {
    if (!tmCompatibilityByMove || !pokemon || !move) return null;
    const ids = tmCompatibilityByMove.get(moveSlug(move));
    return ids ? ids.has(Number(pokemon.id)) : null;
  }

  function populateLists() {
    ui.pokemonList.replaceChildren();
    ui.moveList.replaceChildren();
    const pokemonFragment = document.createDocumentFragment();
    for (const pokemon of pokemonData) {
      const option = document.createElement("option");
      option.value = pokemon.name;
      pokemonFragment.append(option);
    }
    ui.pokemonList.append(pokemonFragment);
    const moveFragment = document.createDocumentFragment();
    for (const move of moveData) {
      const option = document.createElement("option");
      option.value = move.name;
      moveFragment.append(option);
    }
    ui.moveList.append(moveFragment);
  }

  function syncUiFromState() {
    ui.pokemon.value = state.pokemon;
    ui.strategy.value = state.strategy;
    ui.autoPick.checked = state.autoPick;
    ui.autoClaimMissions.checked = state.autoClaimMissions;
    if (!state.tmBuildPokemon) state.tmBuildPokemon = currentPartnerForTms()?.name || state.pokemon;
    ui.tmBuildPokemon.value = state.tmBuildPokemon;
    renderTypes();
    updatePartnerDetails();
    renderTargets();
    renderBuild();
    renderTmInventory();
    renderCommunityBuild();
    renderTmRecommendations();
  }

  function currentPokemon() {
    const key = normalize(state.pokemon);
    return pokemonData.find((pokemon) => normalize(pokemon.name) === key) || null;
  }

  function currentPartnerForTms() {
    const liveName = document.querySelector("#menu-partner-name")?.textContent?.trim();
    return (liveName && findPokemonInText(liveName)) || currentPokemon();
  }

  function updatePartnerDetails() {
    const partner = currentPartnerForTms();
    const gameInfo = document.querySelector("#menu-partner-info")?.innerText?.trim().replace(/\s+/g, " ") || "";
    if (!partner) {
      ui.partnerDetails.textContent = state.pokemon
        ? "Chưa tìm thấy Partner này trong Pokédex tham khảo."
        : "Đang chờ thông tin Partner từ game.";
      return;
    }
    const info = gameInfo || (partner.types.length ? `Hệ ${partner.types.join(" / ")}` : "đang tải thông tin hệ");
    ui.partnerDetails.textContent = `Partner: ${partner.name} #${String(partner.id).padStart(3, "0")} · ${info}`;
  }

  function updateCoinBalance() {
    const coinNode = document.querySelector("#coins");
    const raw = coinNode?.parentElement?.title?.trim() || coinNode?.title?.trim() || coinNode?.textContent?.trim() || "";
    const digits = raw.replace(/[^\d]/g, "");
    gameCoins = digits ? Number(digits) : null;
    ui.coinBalance.textContent = gameCoins === null ? "Chưa đọc" : `${gameCoins.toLocaleString()} PC`;
    if (tmOffers.length) renderTmRecommendations();
    renderCommunityBuild();
  }

  function onPokemonInput() {
    const nextPokemon = ui.pokemon.value.trim();
    if (state.pokemon && normalize(state.pokemon) !== normalize(nextPokemon)) clearRunTracker();
    state.pokemon = nextPokemon;
    state.manualPokemon = true;
    persistState();
    renderTypes();
    refreshRecommendations();
    updatePartnerDetails();
    renderTmRecommendations();
  }

  function observePartnerName() {
    if (!pokemonData.length) return;
    const candidates = ["#menu-partner-name", "#res-name", "#starter-info"];
    for (const selector of candidates) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (!text) continue;
      const match = findPokemonInText(text);
      if (!match || match.name === lastAutoName) continue;
      if (lastAutoName && normalize(match.name) !== normalize(lastAutoName)) clearRunTracker();
      lastAutoName = match.name;
      if (!state.manualPokemon || !state.pokemon) {
        state.pokemon = match.name;
        state.manualPokemon = false;
        persistState();
        syncUiFromState();
        refreshRecommendations();
      }
      updatePartnerDetails();
      renderTmRecommendations();
      return;
    }
  }

  function findPokemonInText(text) {
    const normalizedText = ` ${normalize(text)} `;
    const matches = pokemonData
      .filter((pokemon) => pokemon.name && normalizedText.includes(` ${normalize(pokemon.name)} `))
      .sort((a, b) => normalize(b.name).length - normalize(a.name).length);
    return matches[0] || null;
  }

  function syncPartnerFromGame() {
    const selectors = ["#menu-partner-name", "#res-name", "#starter-info"];
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.textContent?.trim();
      const match = text && findPokemonInText(text);
      if (!match) continue;
      if (state.pokemon && normalize(state.pokemon) !== normalize(match.name)) clearRunTracker();
      state.pokemon = match.name;
      state.manualPokemon = false;
      state.tmBuildPokemon = match.name;
      lastAutoName = match.name;
      persistState();
      syncUiFromState();
      refreshRecommendations();
      updatePartnerDetails();
      renderTmRecommendations();
      return;
    }
    ui.status.textContent = "Chưa đọc được tên Pokémon trong menu game. Hãy chọn hoặc nhập tên ở ô trên.";
  }

  function renderTypes() {
    const pokemon = currentPokemon();
    ui.types.replaceChildren();
    if (!pokemon?.types.length) {
      const label = document.createElement("span");
      label.className = "muted";
      label.textContent = state.pokemon ? "Chưa có hệ trong dữ liệu tham khảo." : "Chưa nhận diện hệ";
      ui.types.append(label);
      return;
    }
    for (const type of pokemon.types) {
      const pill = document.createElement("span");
      pill.className = "type-pill";
      pill.textContent = type;
      ui.types.append(pill);
    }
  }

  function addTarget() {
    const typed = ui.targetInput.value.trim();
    if (!typed) return;
    const exact = moveData.find((move) => normalize(move.name) === normalize(typed));
    const value = exact?.name || typed;
    if (!state.targets.some((item) => normalize(item) === normalize(value))) state.targets.push(value);
    ui.targetInput.value = "";
    persistState();
    renderTargets();
    refreshRecommendations();
    renderTmRecommendations();
  }

  function addKnownMove() {
    const typed = ui.knownMove.value.trim();
    const exact = moveData.find((move) => normalize(move.name) === normalize(typed));
    if (!exact) {
      ui.status.textContent = "Chọn move trong danh sách chính thức để ghi nhận chính xác.";
      return;
    }
    const level = Math.max(1, Math.min(5, Number(ui.knownLevel.value) || 1));
    ui.knownLevel.value = String(level);
    const existing = state.learnedMoves.find((move) => normalize(move.name) === normalize(exact.name));
    if (existing) existing.level = level;
    else if (state.learnedMoves.length < MAX_MOVES_WITH_BONDS) state.learnedMoves.push({ name: exact.name, level, evolved: false });
    else {
      ui.status.textContent = "Đã đủ 16 skill được theo dõi trong lượt này.";
      return;
    }
    ui.knownMove.value = "";
    persistState();
    renderBuild();
    refreshRecommendations();
    renderTmRecommendations();
  }

  function renderTargets() {
    ui.targets.replaceChildren();
    if (!state.targets.length) {
      ui.targets.classList.add("empty");
      ui.targets.textContent = "Chưa chọn skill mục tiêu.";
      return;
    }
    ui.targets.classList.remove("empty");
    for (const target of state.targets) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = `${target} ×`;
      chip.title = "Bỏ skill mục tiêu";
      chip.addEventListener("click", () => {
        state.targets = state.targets.filter((item) => normalize(item) !== normalize(target));
        persistState();
        renderTargets();
        refreshRecommendations();
        renderTmRecommendations();
      });
      ui.targets.append(chip);
    }
  }

  function resetRun() {
    clearRunTracker();
    persistState();
    refreshRecommendations();
    renderTmRecommendations();
  }

  function clearRunTracker() {
    if (autoPickTimer) clearTimeout(autoPickTimer);
    autoPickTimer = null;
    pendingAutoPickSignature = "";
    autoPickSignature = "";
    lastTrackedSelectionSignature = "";
    lastTrackedSelectionAt = 0;
    state.learnedMoves = [];
    state.fusedGroups = [];
    state.statPicks = [];
    state.lastLevel = 0;
    renderBuild();
    renderTmRecommendations();
  }

  function updateLevelUpState() {
    const screen = document.querySelector("#scr-levelup");
    const visible = isScreenVisible(screen);
    lastLevelUpPollFingerprint = `${visible}:${visible ? cardSelectionSignature() : ""}`;
    if (visible !== isLevelUpVisible) {
      const wasVisible = isLevelUpVisible;
      isLevelUpVisible = visible;
      if (visible) setPanelOpen(true);
      else if (wasVisible) {
        setPanelOpen(false);
        autoPickSignature = "";
        if (autoPickTimer) clearTimeout(autoPickTimer);
        autoPickTimer = null;
        pendingAutoPickSignature = "";
        ui.autoStatus.textContent = "Đang chờ lần lên cấp tiếp theo.";
      }
    }
    if (visible) {
      const level = Number(document.querySelector("#lvl-num")?.textContent?.trim());
      if (level > 0 && state.lastLevel > 2 && level <= 2) clearRunTracker();
      if (level > 0 && level !== state.lastLevel) {
        state.lastLevel = level;
        persistState();
      }
      refreshRecommendations();
    }
  }

  function updateGameOverState() {
    const screen = document.querySelector("#scr-over");
    const visible = isScreenVisible(screen);
    if (visible && !wasGameOver) {
      wasGameOver = true;
      clearRunTracker();
      persistState();
      ui.status.textContent = "Pokémon đã bị hạ — build của lượt này đã được reset.";
      setPanelOpen(false);
    } else if (!visible) {
      wasGameOver = false;
    }
  }

  function isScreenVisible(screen) {
    if (!screen?.isConnected || screen.hidden || screen.classList.contains("hidden")) return false;
    const style = getComputedStyle(screen);
    return style.display !== "none" && style.visibility !== "hidden" && screen.getClientRects().length > 0;
  }

  function openMissionsFromGameMenu() {
    const goalsScreen = document.querySelector("#scr-goals");
    if (isScreenVisible(goalsScreen)) {
      selectMissionsTab();
      queueMissionCheck(0);
      ui.missionStatus.textContent = "Đang kiểm tra nhiệm vụ…";
      return;
    }

    const menuScreen = document.querySelector("#scr-menu");
    const missionsButton = menuScreen?.querySelector('[data-go="goals"]');
    if (isScreenVisible(menuScreen) && missionsButton && !missionsButton.disabled) {
      missionsButton.click();
      selectMissionsTab();
      ui.missionStatus.textContent = "Đã mở Missions; đang đọc tiến độ…";
      queueMissionCheck(180);
      return;
    }

    ui.missionStatus.textContent = "Mở Missions từ menu game sau lượt để xem tiến độ và tự nhận thưởng.";
  }

  function openTmShopFromGameMenu() {
    const shopScreen = document.querySelector("#scr-shop");
    if (isScreenVisible(shopScreen)) {
      scanTmShop();
      return;
    }
    const menuScreen = document.querySelector("#scr-menu");
    const shopButton = menuScreen?.querySelector('[data-go="shop"]');
    if (isScreenVisible(menuScreen) && shopButton && !shopButton.disabled) {
      shopButton.click();
      ui.tmStatus.textContent = "Đã mở Kecleon Shop; đang đọc TM và giá…";
      queueTmScan(180);
      return;
    }
    ui.tmStatus.textContent = "Mở Kecleon Shop từ menu game sau lượt để quét TM hôm nay.";
  }

  function openBagFromGameMenu() {
    const bagScreen = document.querySelector("#scr-bag");
    if (isScreenVisible(bagScreen)) {
      scanBagTms();
      return;
    }
    const menuScreen = document.querySelector("#scr-menu");
    const bagButton = menuScreen?.querySelector('[data-go="bag"]');
    if (isScreenVisible(menuScreen) && bagButton && !bagButton.disabled) {
      bagButton.click();
      ui.bagStatus.textContent = "Đã mở Túi; đang đọc các TM…";
      queueBagScan(180);
      return;
    }
    ui.bagStatus.textContent = "Mở Túi từ menu game sau lượt để quét TM.";
  }

  function queueBagScan(delay = 160) {
    if (tmBagScanTimer) return;
    tmBagScanTimer = setTimeout(() => {
      tmBagScanTimer = null;
      if (isScreenVisible(document.querySelector("#scr-bag"))) scanBagTms();
    }, delay);
  }

  function scanBagTms() {
    const bagScreen = document.querySelector("#scr-bag");
    const bagBody = document.querySelector("#bag-body");
    if (!isScreenVisible(bagScreen) || !bagBody) return;

    const cards = Array.from(bagBody.querySelectorAll(".upg-item"));
    const found = [];
    for (const card of cards) {
      const titleText = card.querySelector("b")?.innerText?.trim() || "";
      const match = titleText.match(/^(?:TM|MT|CT)\s+(.+)$/i);
      if (!match) continue;

      const rawName = match[1].trim();
      const move = findMoveByLabel(rawName);
      const countNode = Array.from(card.querySelectorAll("b")).find((node) =>
        /[×x]\s*\d+/i.test(node.innerText || "")
      );
      const count = parseLocalizedInteger(countNode?.innerText) || 1;
      found.push({
        id: move?.id || "",
        name: move?.name || rawName,
        move: move || null,
        count
      });
    }

    const bagText = normalize(bagBody.innerText || "");
    const emptyBag = /empty|vacia|vazio|tui cua ban trong/.test(bagText);
    if (!found.length && !cards.length && !emptyBag) {
      ui.bagStatus.textContent = "Đã mở Túi nhưng chưa nhận diện được dòng TM; chưa thay đổi số liệu đã quét.";
      return;
    }

    ownedTms = found;
    tmBagScannedAt = Date.now();
    ui.bagStatus.textContent = found.length
      ? "Đã quét " + found.length + " loại TM · " + found.reduce((sum, item) => sum + item.count, 0) + " bản."
      : "Đã quét Túi · chưa có TM chưa dùng.";
    renderTmInventory();
    renderTmRecommendations();
    renderCommunityBuild();
  }

  function renderTmInventory() {
    ui.tmInventory.replaceChildren();
    if (!tmBagScannedAt) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Mở Túi trong menu game để đọc TM đang có.";
      ui.tmInventory.append(empty);
      renderTmCandidates();
      return;
    }
    if (!ownedTms.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Không có TM chưa dùng trong Túi.";
      ui.tmInventory.append(empty);
      renderTmCandidates();
      return;
    }
    for (const item of ownedTms) {
      const row = document.createElement("div");
      row.className = "tm-inventory-item";
      const name = document.createElement("strong");
      name.textContent = "TM " + item.name;
      const count = document.createElement("span");
      count.textContent = "×" + item.count;
      row.append(name, count);
      ui.tmInventory.append(row);
    }
    renderTmCandidates();
  }

  function renderTmCandidates() {
    const options = [];
    const seen = new Set();
    for (const item of ownedTms) {
      if (!item.move || seen.has(normalize(item.name))) continue;
      seen.add(normalize(item.name));
      options.push(item);
    }

    const previous = tmCandidateMoveName;
    ui.tmCandidateMove.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "Chọn TM trong Túi" : "Chưa có TM";
    ui.tmCandidateMove.append(placeholder);
    for (const item of options) {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name + " ×" + item.count;
      ui.tmCandidateMove.append(option);
    }

    tmCandidateMoveName = options.some((item) => normalize(item.name) === normalize(previous))
      ? options.find((item) => normalize(item.name) === normalize(previous)).name
      : options[0]?.name || "";
    ui.tmCandidateMove.value = tmCandidateMoveName;
    if (ui.tmCandidateSearch.value !== tmCandidatePokemonFilter) {
      ui.tmCandidateSearch.value = tmCandidatePokemonFilter;
    }
    ui.tmCandidates.replaceChildren();

    const selected = options.find((item) => normalize(item.name) === normalize(tmCandidateMoveName));
    if (!selected) {
      ui.tmCandidateStatus.textContent = tmBagScannedAt
        ? "Túi chưa có TM đã nhận diện; nhập English names nếu tên game đang dịch."
        : "Quét Túi để xem Pokémon có move này trong pool tự nhiên.";
      return;
    }

    const moveType = normalize(selected.move.type);
    const candidates = pokemonData.map((pokemon) => {
      const natural = moveType === "normal" || pokemon.types.some((type) => normalize(type) === moveType);
      const compatible = tmCompatibilityFor(pokemon, selected.move);
      return { pokemon, natural, compatible };
    }).filter((item) => item.natural || item.compatible === true);
    const filter = normalize(tmCandidatePokemonFilter);
    const filtered = filter
      ? candidates.filter(({ pokemon }) => normalize(pokemon.name).includes(filter))
      : candidates;
    const naturalCount = candidates.filter((item) => item.natural).length;
    const compatibleCount = candidates.filter((item) => !item.natural && item.compatible).length;
    ui.tmCandidateStatus.textContent = tmCompatibilityByMove
      ? candidates.length + " Pokémon tương thích với " + selected.name + " (" + naturalCount + " pool tự nhiên · " + compatibleCount + " cần TM theo snapshot " + TM_COMPATIBILITY_REVIEW_DATE + "). Lọc tên rồi chọn để xem build."
      : naturalCount + " Pokémon có move này trong pool tự nhiên. Bảng TM tương thích chưa tải; mở checker để đối chiếu Pokémon khác hệ.";
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Không có Pokémon khớp bộ lọc.";
      ui.tmCandidates.append(empty);
      return;
    }

    const shown = filtered.slice(0, filter ? 12 : 8);
    for (const candidate of shown) {
      const { pokemon, natural } = candidate;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = pokemon.name + (natural ? " · tự nhiên" : " · TM");
      button.title = (natural ? "Move thuộc pool tự nhiên của " : "Move cần TM; bảng nguồn xác nhận tương thích với ") + pokemon.name;
      button.addEventListener("click", () => {
        state.tmBuildPokemon = pokemon.name;
        ui.tmBuildPokemon.value = pokemon.name;
        persistState();
        loadCommunityBuildForSelected();
      });
      ui.tmCandidates.append(button);
    }
    if (filtered.length > shown.length) {
      const more = document.createElement("span");
      more.className = "muted";
      more.textContent = " +" + (filtered.length - shown.length) + " · lọc theo tên để thu hẹp";
      ui.tmCandidates.append(more);
    }
  }

  function queueTmScan(delay = 160) {
    if (tmScanTimer) return;
    tmScanTimer = setTimeout(() => {
      tmScanTimer = null;
      if (isScreenVisible(document.querySelector("#scr-shop"))) scanTmShop();
    }, delay);
  }

  function parseLocalizedInteger(value) {
    const match = String(value || "").match(/\d[\d.,\s]*/);
    return match ? Number(match[0].replace(/\D/g, "")) : null;
  }

  function findMoveByLabel(value) {
    const key = normalize(value);
    if (!key) return null;
    return moveData.find((move) => normalize(move.name) === key)
      || moveData
        .filter((move) => key.includes(normalize(move.name)) || normalize(move.name).includes(key))
        .sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0]
      || null;
  }

  function scanTmShop() {
    const shopScreen = document.querySelector("#scr-shop");
    const shopBody = document.querySelector("#shop-body");
    if (!isScreenVisible(shopScreen) || !shopBody) return;

    const partner = currentPartnerForTms();
    tmOffers = Array.from(shopBody.querySelectorAll('.upg-item button[data-buy^="tm:"]'))
      .map((button) => {
        const card = button.closest(".upg-item");
        const title = card?.querySelector("b");
        const titleText = title?.innerText?.trim() || "";
        const leadingText = Array.from(title?.childNodes || [])
          .find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || titleText;
        const moveNameText = leadingText.replace(/^(?:TM|MT|CT)\s*/i, "").trim();
        const move = findMoveByLabel(moveNameText) || findMoveByLabel(titleText);
        const description = card?.querySelector(".sub")?.innerText?.trim() || "";
        const normalizedDescription = normalize(description);
        const highlightedStatus = card?.querySelector(".sub .gold");
        const normalizedStatus = normalize(highlightedStatus?.innerText || description);
        const alreadyKnows = /already knows|ya la sabe|la connait deja|la conosce gia|ja sabe|ja a sabe|da biet/.test(normalizedStatus)
          || /已学会|已经会|已经学会/.test(highlightedStatus?.innerText || "");
        const canLearn = /can learn|la puede aprender|peut apprendre|puo impararla|pode aprender|co the hoc/.test(normalizedStatus)
          || Boolean(highlightedStatus && !alreadyKnows);
        const matchesMoveDescription = Boolean(move?.description && normalizedDescription === normalize(move.description));
        const learnability = alreadyKnows ? "known" : canLearn ? "learnable" : matchesMoveDescription ? "unlearnable" : "unknown";
        const countText = card?.querySelector("b small.gold")?.innerText || "";
        const bagCount = ownedTms.find((item) => normalize(item.name) === normalize(move?.name || moveNameText))?.count || 0;
        return {
          id: button.dataset.buy.slice(3),
          name: move?.name || moveNameText,
          move,
          price: parseLocalizedInteger(button.innerText),
          ownedCount: Math.max(parseLocalizedInteger(countText) || 0, bagCount),
          learnability,
          description
        };
      });
    tmShopScannedAt = Date.now();

    const learnableCount = tmOffers.filter((offer) => offer.learnability === "learnable").length;
    const knownCount = tmOffers.filter((offer) => offer.learnability === "known").length;
    const unmatchedCount = tmOffers.filter((offer) => !offer.move).length;
    const partnerLabel = partner?.name || "chưa nhận diện Partner";
    ui.tmStatus.textContent = tmOffers.length
      ? `Đã quét ${tmOffers.length} TM hôm nay cho ${partnerLabel}; ${learnableCount} TM dạy được, ${knownCount} Partner đã biết${unmatchedCount ? ` · ${unmatchedCount} tên chưa nhận diện` : ""}.`
      : "Shop đang tải danh sách TM; extension sẽ quét lại khi nội dung xuất hiện.";
    renderTmRecommendations();
    renderCommunityBuild();
  }

  async function loadCommunityBuildForSelected() {
    if (!pokemonData.length) {
      ui.tmBuildStatus.textContent = "Đang tải Pokédex; hãy thử lại sau.";
      return;
    }
    const typedName = ui.tmBuildPokemon.value.trim();
    const pokemon = pokemonData.find((item) => normalize(item.name) === normalize(typedName))
      || findPokemonInText(typedName);
    if (!pokemon) {
      ui.tmBuildStatus.textContent = "Chọn Pokémon có trong danh sách Pokédex để đối chiếu build.";
      return;
    }

    state.tmBuildPokemon = pokemon.name;
    ui.tmBuildPokemon.value = pokemon.name;
    persistState();
    communityBuild = null;
    const requestId = ++communityBuildRequestId;
    ui.tmBuildStatus.textContent = "Đang tải build tham khảo cho " + pokemon.name + "…";
    ui.tmBuildResult.replaceChildren();

    try {
      const indexResponse = await chrome.runtime.sendMessage({ type: "psba:get-community-build-index" });
      if (!indexResponse || indexResponse.error) throw new Error(indexResponse?.error || "Không đọc được danh sách build.");
      const slug = findCommunityBuildSlug(indexResponse.html, pokemon);
      if (!slug) throw new Error("Nguồn tham khảo chưa có trang build cho Pokémon này.");

      const pageResponse = await chrome.runtime.sendMessage({
        type: "psba:get-community-build-page",
        slug
      });
      if (!pageResponse || pageResponse.error) throw new Error(pageResponse?.error || "Không tải được trang build.");
      const parsed = parseCommunityBuildPage(pageResponse.html, pokemon);
      if (!parsed.moves.length) throw new Error("Trang tham khảo chưa có bảng moves mà extension nhận diện được.");
      if (requestId !== communityBuildRequestId) return;

      communityBuild = {
        ...parsed,
        pokemon,
        url: pageResponse.url,
        sourceDate: parsed.sourceDate || "chưa ghi ngày"
      };
      ui.tmBuildStatus.textContent = "Đã nạp build tham khảo cho " + pokemon.name + " · dữ liệu nguồn " + communityBuild.sourceDate + ".";
      renderCommunityBuild();
    } catch (error) {
      if (requestId !== communityBuildRequestId) return;
      ui.tmBuildStatus.textContent = (error?.message || "Không tải được build cộng đồng.")
        + " Có thể mở nguồn Builds 966 ở các liên kết bên dưới.";
      ui.tmBuildResult.replaceChildren();
    }
  }

  function findCommunityBuildSlug(indexHtml, pokemon) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexHtml || "", "text/html");
    const link = Array.from(doc.querySelectorAll('a[href*="/builds/"]')).find((item) => {
      const href = item.getAttribute("href") || "";
      const path = new URL(href, "https://pokesurvivors.org").pathname.split("/").filter(Boolean);
      if (path.length < 2 || path[0] !== "builds") return false;
      const label = (item.textContent || "").replace(/^#?\s*\d+\s*/, "").trim();
      return normalize(label) === normalize(pokemon.name);
    });
    if (!link) return "";
    const path = new URL(link.getAttribute("href"), "https://pokesurvivors.org").pathname.split("/").filter(Boolean);
    return path.length > 1 ? path[1] : "";
  }

  function parseCommunityBuildPage(html, pokemon) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || "", "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    const table = tables.find((item) => {
      const row = item.querySelector("tr");
      const cells = Array.from(row?.cells || []);
      const labels = cells.map((cell) => normalize(cell.textContent));
      return labels.some((label) => label === "slot") && labels.some((label) => label === "move");
    });
    if (!table) return { title: "", moves: [], sourceDate: "" };

    const rows = Array.from(table.querySelectorAll("tr"));
    const headerCells = Array.from(rows[0]?.cells || []);
    const headers = headerCells.map((cell) => normalize(cell.textContent));
    const moveIndex = headers.indexOf("move");
    if (moveIndex < 0) return { title: "", moves: [], sourceDate: "" };

    const moves = rows.slice(1).map((row) => {
      const cell = row.cells[moveIndex];
      const link = cell?.querySelector("a");
      const label = (link?.textContent || cell?.textContent || "").trim();
      const move = findMoveByLabel(label);
      return {
        slot: row.cells[0]?.textContent?.trim() || "",
        name: move?.name || label,
        move: move || null
      };
    }).filter((item) => item.name).slice(0, MAX_MOVE_SLOTS);

    const pageText = doc.body?.innerText || doc.body?.textContent || "";
    const gameDataMatch = pageText.match(/Game data from[\s\S]{0,180}?Last updated\s+(\d{4}-\d{2}-\d{2})/i);
    const pageDateMatch = pageText.match(/Page updated\s+(\d{4}-\d{2}-\d{2})/i);
    return {
      title: doc.querySelector("h1")?.textContent?.trim() || (pokemon.name + " build"),
      moves,
      sourceDate: gameDataMatch?.[1] || pageDateMatch?.[1] || ""
    };
  }

  function renderCommunityBuild() {
    if (!ui.tmBuildResult) return;
    ui.tmBuildResult.replaceChildren();
    if (!communityBuild) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = state.tmBuildPokemon
        ? "Nhấn So sánh để tải build tham khảo và đối chiếu TM."
        : "Chọn Pokémon để tải build tham khảo cộng đồng.";
      ui.tmBuildResult.append(message);
      return;
    }

    const pokemon = communityBuild.pokemon;
    const livePartner = currentPartnerForTms();
    const targetIsLive = Boolean(livePartner && normalize(livePartner.name) === normalize(pokemon.name));
    const rows = [];
    let naturalCount = 0;
    let tmNeededCount = 0;
    let ownedNeededCount = 0;
    let compatibleNeededCount = 0;
    let incompatibleCount = 0;
    let unknownCompatibilityCount = 0;
    let buyTotal = 0;
    let priceUnknownCount = 0;

    for (const item of communityBuild.moves) {
      const move = item.move;
      const natural = Boolean(move && (
        normalize(move.type) === "normal"
        || pokemon.types.some((type) => normalize(type) === normalize(move.type))
      ));
      const offer = tmOffers.find((entry) => normalize(entry.name) === normalize(item.name));
      const bagCount = ownedTms.find((entry) => normalize(entry.name) === normalize(item.name))?.count || 0;
      const ownedCount = Math.max(bagCount, offer?.ownedCount || 0);
      const sourceCompatibility = tmCompatibilityFor(pokemon, move);
      const liveCompatibility = targetIsLive && offer?.learnability === "learnable"
        ? true
        : targetIsLive && offer?.learnability === "unlearnable"
          ? false
          : null;
      const compatible = liveCompatibility === null ? sourceCompatibility : liveCompatibility;
      const alreadyKnown = targetIsLive && offer?.learnability === "known";
      let detail = "";

      if (!move) {
        detail = "Tên move chưa khớp danh mục; chưa tính được hệ hoặc TM.";
      } else if (natural) {
        naturalCount += 1;
        detail = ownedCount
          ? "Có sẵn trong pool tự nhiên; không cần dùng TM trong Túi."
          : "Pool tự nhiên theo hệ; không cần mua hoặc dạy TM.";
      } else {
        if (alreadyKnown) {
          detail = "Partner hiện tại đã biết move; không cần thêm TM.";
        } else {
          tmNeededCount += 1;
          if (compatible === true) compatibleNeededCount += 1;
          else if (compatible === false) incompatibleCount += 1;
          else unknownCompatibilityCount += 1;

          if (ownedCount > 0 && compatible === true) {
            ownedNeededCount += 1;
            detail = "Có TM trong Túi ×" + ownedCount + " · nguồn xác nhận Pokémon này học được.";
          } else if (ownedCount > 0 && compatible === false) {
            detail = "Có TM trong Túi ×" + ownedCount + " · nguồn snapshot không xác nhận Pokémon này học được TM.";
          } else if (ownedCount > 0) {
            detail = "Có TM trong Túi ×" + ownedCount + " · chưa có dữ liệu xác nhận tương thích.";
          } else if (compatible === false) {
            detail = "TM này không tương thích theo dữ liệu game đã rà soát.";
          } else if (compatible === true && targetIsLive && offer?.price !== null && offer?.price !== undefined) {
            buyTotal += offer.price;
            detail = "Thiếu 1 TM · Shop hôm nay bán " + offer.price.toLocaleString() + " PokéCoin.";
          } else if (compatible === true) {
            priceUnknownCount += 1;
            detail = "Cần 1 TM · nguồn xác nhận tương thích; Shop hôm nay chưa có giá cho move này.";
          } else if (targetIsLive && offer?.learnability === "learnable") {
            if (offer.price !== null) {
              buyTotal += offer.price;
              detail = "Thiếu 1 TM · Shop hôm nay bán " + offer.price.toLocaleString() + " PokéCoin.";
            } else {
              priceUnknownCount += 1;
              detail = "Shop xác nhận Partner học được nhưng chưa đọc được giá.";
            }
          } else if (targetIsLive && offer?.learnability === "unlearnable") {
            detail = "Shop hiện báo Partner không học được TM này.";
          } else if (offer && offer.price !== null) {
            priceUnknownCount += 1;
            detail = "Thiếu TM · Shop có bán hôm nay giá " + offer.price.toLocaleString() + " PokéCoin; chưa xác nhận cho Pokémon đã chọn.";
          } else if (!tmBagScannedAt && !offer) {
            detail = "Chưa quét Túi nên chưa biết có TM này hay không; cần kiểm tra tương thích trước khi dạy.";
          } else {
            detail = "Build có move khác hệ; chưa có TM trong Túi và Shop chưa có offer để xác nhận.";
          }
        }
      }

      rows.push({ ...item, detail, natural, ownedCount, compatible });
    }

    const summary = document.createElement("div");
    summary.className = "tm-budget";
    const budget = targetIsLive
      ? gameCoins === null
        ? "Pool tự nhiên " + naturalCount + "/" + rows.length + " · cần TM " + tmNeededCount + " · tương thích " + compatibleNeededCount + " · có trong Túi và dùng được " + ownedNeededCount + " · không tương thích " + incompatibleCount + " · Shop có giá " + buyTotal.toLocaleString() + " PokéCoin" + (priceUnknownCount ? " · " + priceUnknownCount + " TM chưa có offer/giá" : "") + " · chưa đọc được số dư" + (!tmBagScannedAt ? " · hãy quét Túi để đọc số lượng" : "") + (unknownCompatibilityCount ? " · " + unknownCompatibilityCount + " move chưa xác định" : "")
        : "Pool tự nhiên " + naturalCount + "/" + rows.length + " · cần TM " + tmNeededCount + " · tương thích " + compatibleNeededCount + " · có trong Túi và dùng được " + ownedNeededCount + " · không tương thích " + incompatibleCount + " · Shop có giá " + buyTotal.toLocaleString() + " PokéCoin" + (priceUnknownCount ? " · " + priceUnknownCount + " TM chưa có offer/giá" : "") + (gameCoins >= buyTotal ? " · còn " + Math.max(0, gameCoins - buyTotal).toLocaleString() + " sau offer có giá" : " · thiếu " + Math.max(0, buyTotal - gameCoins).toLocaleString() + " cho offer có giá") + (!tmBagScannedAt ? " · hãy quét Túi để đọc số lượng" : "") + (unknownCompatibilityCount ? " · " + unknownCompatibilityCount + " move chưa xác định" : "")
      : "Pool tự nhiên " + naturalCount + "/" + rows.length + " · cần TM " + tmNeededCount + " · tương thích " + compatibleNeededCount + " · có trong Túi và dùng được " + ownedNeededCount + " · không tương thích " + incompatibleCount + " · mức tương thích chỉ theo snapshot " + TM_COMPATIBILITY_REVIEW_DATE + "." + (!tmBagScannedAt ? " Hãy quét Túi để đọc số lượng." : "") + (unknownCompatibilityCount ? " Còn " + unknownCompatibilityCount + " move chưa xác định." : "");
    summary.textContent = budget;
    ui.tmBuildResult.append(summary);

    for (const [index, item] of rows.entries()) {
      const row = document.createElement("div");
      row.className = "recommendation" + (index === 0 ? " best" : "");
      const head = document.createElement("div");
      head.className = "recommendation-head";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const type = document.createElement("span");
      type.className = "score";
      type.textContent = item.move?.type || "TM";
      head.append(name, type);
      const detail = document.createElement("p");
      detail.textContent = item.detail;
      row.append(head, detail);
      ui.tmBuildResult.append(row);
    }

    const footer = document.createElement("p");
    footer.className = "muted tm-help";
    footer.textContent = "Nguồn build cộng đồng là gợi ý tạo từ luật game, không phải xếp hạng win-rate. TM khác hệ cần kiểm tra tương thích và dạy thủ công.";
    const link = document.createElement("a");
    link.href = communityBuild.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Mở build nguồn";
    footer.append(document.createTextNode(" "), link);
    ui.tmBuildResult.append(footer);
  }

  function selectMissionsTab() {
    const missionsTab = document.querySelector('#goals-tabs .tab[data-tab="missions"]');
    if (missionsTab && !missionsTab.classList.contains("on")) missionsTab.click();
  }

  function queueMissionCheck(delay = 120) {
    if (missionCheckTimer) return;
    missionCheckTimer = setTimeout(() => {
      missionCheckTimer = null;
      updateMissionState();
    }, delay);
  }

  function missionSignature(card, index) {
    return `${index}:${normalize(card.innerText || card.textContent || "")}`;
  }

  function updateMissionState() {
    const goalsScreen = document.querySelector("#scr-goals");
    const goalsBody = document.querySelector("#goals-body");
    if (!isScreenVisible(goalsScreen) || !goalsBody) {
      ui.missionStatus.textContent = "Mở Missions trong menu game để đồng bộ tiến độ.";
      return;
    }

    const cards = Array.from(goalsBody.querySelectorAll(".mission"));
    if (!cards.length) {
      ui.missionStatus.textContent = "Đã mở Missions; đang chờ dữ liệu nhiệm vụ.";
      return;
    }

    const ready = cards.filter((card) => card.classList.contains("ready") && !card.classList.contains("claimed"));
    const claimed = cards.filter((card) => card.classList.contains("claimed"));
    const inProgress = Math.max(0, cards.length - ready.length - claimed.length);
    ui.missionStatus.textContent = `${ready.length} chờ nhận · ${claimed.length} đã nhận · ${inProgress} đang tiến hành${state.autoClaimMissions ? " · tự nhận đang bật" : ""}.`;

    if (!state.autoClaimMissions || !ready.length || missionClaimTimer) return;
    const now = Date.now();
    const nextClaim = ready
      .map((card) => ({ card, index: cards.indexOf(card), button: card.querySelector("button:not([disabled])") }))
      .find(({ card, index, button }) => {
        if (!button) return false;
        const signature = missionSignature(card, index);
        const attemptedAt = missionClaimAttempts.get(signature) || 0;
        return now - attemptedAt > 10_000;
      });
    if (!nextClaim) return;

    const signature = missionSignature(nextClaim.card, nextClaim.index);
    missionClaimAttempts.set(signature, now);
    if (missionClaimAttempts.size > 80) {
      for (const [key, attemptedAt] of missionClaimAttempts) {
        if (now - attemptedAt > 60_000) missionClaimAttempts.delete(key);
      }
    }
    missionClaimTimer = setTimeout(() => {
      missionClaimTimer = null;
      const currentGoals = document.querySelector("#goals-body");
      if (!state.autoClaimMissions || !isScreenVisible(document.querySelector("#scr-goals")) || !currentGoals) return;
      const currentCards = Array.from(currentGoals.querySelectorAll(".mission"));
      const currentCard = currentCards.find((card, index) => missionSignature(card, index) === signature);
      const claimButton = currentCard?.querySelector("button:not([disabled])");
      if (!currentCard?.classList.contains("ready") || currentCard.classList.contains("claimed") || !claimButton) return;
      claimButton.click();
      ui.missionStatus.textContent = "Đã bấm nhận thưởng; đang cập nhật danh sách nhiệm vụ…";
      queueMissionCheck(300);
    }, 160);
  }

  function cardNodes() {
    const cardsRoot = document.querySelector("#cards");
    if (!cardsRoot) return [];
    const cardClassNodes = Array.from(cardsRoot.querySelectorAll(".card"));
    if (cardClassNodes.length >= 2) return cardClassNodes;
    const buttons = Array.from(cardsRoot.querySelectorAll('button, [role="button"]'));
    if (buttons.length >= 2) return buttons;
    return Array.from(cardsRoot.children).filter((node) => node instanceof HTMLElement);
  }

  function candidateFromCard(card) {
    const parts = [card.innerText || card.textContent || ""];
    const attributes = [];
    for (const element of [card, ...card.querySelectorAll("[data-id], [data-move], [data-type], [title], [aria-label]")]) {
      for (const attribute of ["data-id", "data-move", "data-type", "title", "aria-label"]) {
        const value = element.getAttribute?.(attribute);
        if (value) attributes.push(value);
      }
    }
    const classes = [card.className, ...Array.from(card.querySelectorAll("[class]"), (node) => node.className)]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
    const fullText = `${parts.join(" ")} ${attributes.join(" ")}`;
    const normalizedText = normalize(fullText);
    const move = moveData
      .filter((item) => normalizedText.includes(normalize(item.name)))
      .sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0] || null;
    const evolution = /evol|golden|gold card|evolved/.test(normalizedText) || /\bevo\b|evolution|golden/.test(classes);
    const stat = move ? "" : EVO_STATS.find((item) => normalizedText.includes(normalize(item))) || "";
    const visibleText = (card.innerText || card.textContent || "").trim().replace(/\s+/g, " ");
    return { element: card, text: visibleText || attributes.join(" ").trim(), normalizedText, move, evolution, stat };
  }

  function moveProfile(move) {
    const description = normalize(move?.description);
    const kind = normalize(move?.kind);
    const category = normalize(move?.category);
    const statuses = [];
    if (/burn|burns|burned/.test(description)) statuses.push("burn");
    if (/poison|poisons|poisoned|toxic/.test(description)) statuses.push("poison");
    if (/slow|slows|slowed/.test(description)) statuses.push("slow");
    if (/freeze|freezes|frozen/.test(description)) statuses.push("freeze");
    if (/stun|stuns|paraly/.test(description)) statuses.push("stun");
    return {
      category: category === "physical" ? "Physical" : category === "special" ? "Special" : "",
      isBuff: kind === "buff" || /deals no damage|builds/.test(description),
      buffTarget: /physical.{0,18}attack/.test(description) ? "Physical" : /special attack/.test(description) ? "Special" : "",
      area: /orbit|aura|burst|spin|melee|shove|vortex|quake|spray|cone|nova/.test(kind) || /around you|in every direction|nearby/.test(description),
      targeted: /projectile|homing|chain|bounce|turret|beam|charge|dash|boomerang|meteor|mine|trail/.test(kind),
      control: /slow|freeze|stun|paraly|push|knock|pull|trap|snare|drag/.test(description),
      sustain: /heal|heals|healing|regeneration|regen/.test(description),
      statuses
    };
  }

  function getMoveData(name) {
    return moveData.find((move) => normalize(move.name) === normalize(name)) || null;
  }

  function synergyScore(move) {
    const learned = state.learnedMoves.map((item) => getMoveData(item.name)).filter(Boolean);
    if (!learned.length) return { score: 0, reasons: [] };
    const profile = moveProfile(move);
    const learnedProfiles = learned.map((item) => ({ move: item, profile: moveProfile(item) }));
    const reasons = [];
    let score = 0;

    if (profile.isBuff && profile.buffTarget) {
      const matching = learnedProfiles.filter((item) => item.profile.category === profile.buffTarget).length;
      if (matching) {
        score += Math.min(18, 10 + matching * 4);
        reasons.push(`buff hỗ trợ ${matching} move ${profile.buffTarget === "Physical" ? "vật lý" : "đặc biệt"}`);
      }
    }
    if (profile.category) {
      const supported = learnedProfiles.some((item) => item.profile.isBuff && item.profile.buffTarget === profile.category);
      if (supported) {
        score += 10;
        reasons.push(`ăn khớp buff ${profile.category === "Physical" ? "vật lý" : "đặc biệt"} đã học`);
      }
    }
    if (profile.control && learnedProfiles.some((item) => !item.profile.isBuff && !item.profile.control)) {
      score += 6;
      reasons.push("bổ sung khống chế cho nhóm gây sát thương đang có");
    }
    if (profile.area && learnedProfiles.some((item) => item.profile.targeted && !item.profile.isBuff)) {
      score += 5;
      reasons.push("bù vùng đánh cho move nhắm mục tiêu");
    }
    if (profile.targeted && learnedProfiles.some((item) => item.profile.area && !item.profile.isBuff)) {
      score += 5;
      reasons.push("bù khả năng đánh mục tiêu cho move diện rộng");
    }
    if (profile.sustain && learnedProfiles.some((item) => !item.profile.isBuff)) {
      score += state.strategy === "survival" ? 9 : 4;
      reasons.push("ghép hồi phục với nhóm gây sát thương");
    }

    const description = normalize(move.description);
    if (/more damage if they are burned poisoned or slowed/.test(description)) {
      const statusReady = learnedProfiles.some((item) => item.profile.statuses.some((status) => ["burn", "poison", "slow"].includes(status)));
      if (statusReady) {
        score += 18;
        reasons.push("kích hoạt điều kiện gây thêm sát thương của Hex");
      }
    }
    return { score: Math.min(score, 30), reasons };
  }

  function scoreCandidate(candidate, pokemonOverride = null) {
    let score = 0;
    const reasons = [];
    const pokemon = pokemonOverride || currentPokemon();
    const learned = state.learnedMoves.find((item) => candidate.move && normalize(item.name) === normalize(candidate.move.name));
    const strategy = state.strategy;

    if (candidate.evolution) {
      score += 100;
      reasons.push("thẻ tiến hóa vàng đã mở");
    }

    if (candidate.move) {
      const move = candidate.move;
      if (state.targets.some((target) => normalize(target) === normalize(move.name))) {
        score += 38;
        reasons.push("đúng skill mục tiêu");
      }
      const typeMatch = pokemon?.types.some((type) => normalize(type) === normalize(move.type));
      if (typeMatch) {
        score += 15;
        reasons.push(`đúng hệ Partner ${move.type} (+20% sát thương trong game)`);
      }
      if (strategy === "physical" && move.category === "Physical") {
        score += 12;
        reasons.push("khớp hướng vật lý");
      }
      if (strategy === "special" && move.category === "Special") {
        score += 12;
        reasons.push("khớp hướng đặc biệt");
      }
      if (learned) {
        score += 16;
        reasons.push(`nâng move đang có (${learned.level || 1}/5)`);
      } else if (!state.learnedMoves.length) {
        score += 15;
        reasons.push("mở bộ skill đầu lượt");
      } else if (state.learnedMoves.length < 2) {
        score += 7;
        reasons.push("mở rộng bộ move đầu lượt");
      }
      const synergy = synergyScore(move);
      score += synergy.score;
      reasons.push(...synergy.reasons);
      const profile = moveProfile(move);
      if (strategy === "survival" && (profile.sustain || profile.control || /armor|defen|heal/i.test(`${move.description} ${move.kind}`))) {
        score += 9;
        reasons.push("có khống chế hoặc hỗ trợ sinh tồn");
      }
      if (strategy === "evolve" && move.evoStat) {
        score += 3;
        reasons.push(`có công thức tiến hóa với ${move.evoStat}`);
      }
    }

    if (candidate.stat) {
      const recipes = moveData.filter((move) => move.evoStat && state.learnedMoves.some((item) => normalize(item.name) === normalize(move.name) && !item.evolved) && normalize(move.evoStat) === normalize(candidate.stat));
      const targetRecipes = moveData.filter((move) => move.evoStat && state.targets.some((target) => normalize(target) === normalize(move.name)) && normalize(move.evoStat) === normalize(candidate.stat));
      if (recipes.length) {
        const closest = Math.max(...recipes.map((move) => state.learnedMoves.find((item) => normalize(item.name) === normalize(move.name))?.level || 1));
        score += closest >= 5 ? 34 : closest >= 4 ? 27 : closest >= 3 ? 19 : 10;
        const nearlyReady = recipes.filter((move) => (state.learnedMoves.find((item) => normalize(item.name) === normalize(move.name))?.level || 1) >= 5);
        reasons.push(nearlyReady.length
          ? `đúng stat tiến hóa cho ${nearlyReady.map((move) => move.name).slice(0, 2).join(", ")} Lv 5`
          : `đang chuẩn bị tiến hóa cho ${recipes.map((move) => move.name).slice(0, 2).join(", ")}`);
      }
      if (targetRecipes.length) {
        score += 20;
        reasons.push(`cần cho skill mục tiêu ${targetRecipes[0].name}`);
      }
      if (strategy === "evolve" && (recipes.length || targetRecipes.length)) score += 10;
      if (strategy === "survival" && ["Armor", "Synthesis", "Vigor"].includes(candidate.stat)) {
        score += 9;
        reasons.push("hợp hướng tăng khả năng trụ lại");
      }
      const statCount = state.statPicks.filter((item) => normalize(item) === normalize(candidate.stat)).length;
      if (statCount >= 2 && !recipes.length && !targetRecipes.length) score -= 5;
    }

    if (!candidate.move && !candidate.stat && !candidate.evolution) {
      if (/heal|regen|shield|armor|health|hp|revive|defen/i.test(candidate.normalizedText)) {
        score += strategy === "survival" ? 16 : 6;
        reasons.push("hiệu ứng phòng thủ hoặc hồi phục");
      }
      if (/damage|attack|power|cooldown|projectile|speed/i.test(candidate.normalizedText) && ["balanced", "physical", "special", "evolve"].includes(strategy)) {
        score += 4;
        reasons.push("tăng sức mạnh tổng quát");
      }
    }

    if (score <= 0) {
      score = 1;
      reasons.push(reasons.length
        ? "điểm nền; giữ ưu tiên theo thứ tự thẻ game"
        : "chưa khớp dữ liệu move; giữ điểm nền và ưu tiên theo thứ tự thẻ game");
    } else if (!reasons.length) {
      reasons.push("move chưa có dữ liệu phân tích chi tiết");
    }
    return { ...candidate, score, reasons };
  }

  function renderTmRecommendations() {
    ui.tmRecommendations.replaceChildren();
    if (!tmOffers.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Gợi ý mua và build TM theo Partner sẽ hiển thị sau khi quét Shop.";
      ui.tmRecommendations.append(message);
      return;
    }

    const partner = currentPartnerForTms();
    if (!partner) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Chưa nhận diện Partner. Đồng bộ hoặc chọn Pokémon để xếp build TM.";
      ui.tmRecommendations.append(message);
      return;
    }

    const ranked = tmOffers
      .filter((offer) => offer.move && offer.learnability === "learnable")
      .map((offer) => {
        const candidate = scoreCandidate({
          text: offer.move.name,
          normalizedText: normalize(`${offer.move.name} ${offer.move.description}`),
          move: offer.move,
          evolution: false,
          stat: ""
        }, partner);
        if (offer.ownedCount > 0) {
          candidate.score += 5;
          candidate.reasons.unshift("đã có trong Túi, không tốn thêm PokéCoin");
        }
        candidate.reasons.unshift("Partner học được TM này");
        return { ...offer, score: candidate.score + 10, reasons: candidate.reasons };
      })
      .sort((a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity));

    if (!ranked.length) {
      const message = document.createElement("p");
      message.className = "muted";
      const unknownCount = tmOffers.filter((offer) => offer.move && offer.learnability === "unknown").length;
      const unmatchedCount = tmOffers.filter((offer) => !offer.move).length;
      message.textContent = unknownCount
        ? `Đọc được ${unknownCount} TM nhưng chưa xác nhận Partner học được từ thông tin Shop. Không xếp chúng vào build để tránh gợi ý sai.`
        : unmatchedCount
          ? `${unmatchedCount} tên TM chưa khớp danh mục tham khảo; đổi ngôn ngữ game sang English rồi quét lại để nhận diện chính xác.`
          : "Trong 8 TM hôm nay chưa có move mới mà Partner học được.";
      ui.tmRecommendations.append(message);
      return;
    }

    const build = chooseTmBuild(ranked, partner);
    const unpriced = build.some((offer) => offer.ownedCount === 0 && offer.price === null);
    const purchaseTotal = build.reduce((sum, offer) => sum + (offer.ownedCount > 0 ? 0 : offer.price || 0), 0);
    const summary = document.createElement("div");
    summary.className = "tm-budget";
    const budgetText = gameCoins === null
      ? `Build ${build.length} TM · cần ${purchaseTotal.toLocaleString()} PokéCoin${unpriced ? " trở lên; còn TM chưa đọc được giá" : ""} · chưa đọc được số dư.`
      : gameCoins >= purchaseTotal
        ? `Build ${build.length} TM · cần ${purchaseTotal.toLocaleString()} · còn ${Math.max(0, gameCoins - purchaseTotal).toLocaleString()} PokéCoin${unpriced ? " trở lên; còn TM chưa đọc được giá" : ""}.`
        : `Build ${build.length} TM · cần ${purchaseTotal.toLocaleString()} · thiếu ${(purchaseTotal - gameCoins).toLocaleString()} PokéCoin${unpriced ? " trở lên; còn TM chưa đọc được giá" : ""}.`;
    summary.textContent = budgetText;
    ui.tmRecommendations.append(summary);

    for (const [index, offer] of build.entries()) {
      const row = document.createElement("div");
      row.className = `recommendation ${index === 0 ? "best" : ""}`;
      const head = document.createElement("div");
      head.className = "recommendation-head";
      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${offer.move.name}`;
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = `${offer.planScore}đ`;
      head.append(title, score);

      const cost = document.createElement("p");
      if (offer.ownedCount > 0) {
        cost.textContent = `Có trong Túi ×${offer.ownedCount} · dùng ngay, không cần mua thêm.`;
      } else if (offer.price === null) {
        cost.textContent = "Chưa đọc được giá TM trong Shop.";
      } else if (gameCoins === null) {
        cost.textContent = `Giá ${offer.price.toLocaleString()} PokéCoin · chưa đọc được số dư.`;
      } else if (gameCoins >= offer.price) {
        cost.textContent = `Giá ${offer.price.toLocaleString()} PokéCoin · mua được, còn ${(gameCoins - offer.price).toLocaleString()}.`;
      } else {
        cost.textContent = `Giá ${offer.price.toLocaleString()} PokéCoin · thiếu ${(offer.price - gameCoins).toLocaleString()}.`;
      }
      const reason = document.createElement("p");
      reason.textContent = [...offer.reasons, ...offer.synergyReasons].slice(0, 4).join(" · ");
      row.append(head, cost, reason);
      ui.tmRecommendations.append(row);
    }

    const help = document.createElement("p");
    help.className = "muted tm-help";
    const scannedAt = tmShopScannedAt ? new Date(tmShopScannedAt).toLocaleTimeString() : "vừa quét";
    const comboNotes = [...new Set(build.flatMap((offer) => offer.synergyReasons))].slice(0, 2);
    help.textContent = `Build xét phối hợp giữa các TM${comboNotes.length ? `: ${comboNotes.join(" · ")}` : ""} · quét lúc ${scannedAt}. Mua ở Shop, sau đó dùng trong Túi.`;
    ui.tmRecommendations.append(help);
  }

  function chooseTmBuild(candidates, pokemon) {
    const targetSize = Math.min(MAX_MOVE_SLOTS, candidates.length);
    let bestTotal = -Infinity;
    let bestMoves = [];
    let bestPairs = [];
    const selected = [];

    function search(startIndex) {
      if (selected.length === targetSize) {
        const pairs = [];
        let total = selected.reduce((sum, offer) => sum + offer.score, 0);
        for (let i = 0; i < selected.length; i += 1) {
          for (let j = i + 1; j < selected.length; j += 1) {
            const result = fusionPairScore(selected[i].move, selected[j].move, pokemon);
            pairs.push({ first: selected[i], second: selected[j], ...result });
            total += result.score * 0.45;
          }
        }
        if (total > bestTotal) {
          bestTotal = total;
          bestMoves = [...selected];
          bestPairs = pairs;
        }
        return;
      }

      const needed = targetSize - selected.length;
      for (let i = startIndex; i <= candidates.length - needed; i += 1) {
        selected.push(candidates[i]);
        search(i + 1);
        selected.pop();
      }
    }

    search(0);
    return bestMoves
      .map((offer) => {
        const relatedPairs = bestPairs.filter((pair) => pair.first === offer || pair.second === offer);
        const pairBonus = relatedPairs.reduce((sum, pair) => sum + pair.score * 0.45, 0);
        const synergyReasons = [...new Set(relatedPairs.flatMap((pair) => pair.reasons))];
        return { ...offer, planScore: Math.round(offer.score + pairBonus), synergyReasons };
      })
      .sort((a, b) => b.planScore - a.planScore || (a.price ?? Infinity) - (b.price ?? Infinity));
  }

  function refreshRecommendations() {
    cachedCandidates = rankCurrentCandidates();
    const hasClearRecommendation = cachedCandidates.length > 0;
    cardNodes().forEach((card) => {
      card.removeAttribute("data-psba-rank");
      card.removeAttribute("data-psba-label");
    });
    if (hasClearRecommendation) cachedCandidates.forEach((candidate, index) => {
      if (index < 3) {
        candidate.element.setAttribute("data-psba-rank", String(index + 1));
        candidate.element.setAttribute("data-psba-label", `#${index + 1}`);
      }
    });
    renderRecommendations(cachedCandidates, hasClearRecommendation);
    const level = document.querySelector("#lvl-num")?.textContent?.trim();
    ui.level.textContent = isLevelUpVisible ? `Level ${level || "?"}` : "chờ thẻ";
    scheduleAutoPick(cachedCandidates);
  }

  function rankCurrentCandidates() {
    return cardNodes()
      .map((card, choiceIndex) => ({ ...candidateFromCard(card), choiceIndex }))
      .filter((candidate) => candidate.text)
      .map(scoreCandidate)
      .sort((a, b) => b.score - a.score || a.choiceIndex - b.choiceIndex);
  }

  function cardSelectionSignature() {
    const level = document.querySelector("#lvl-num")?.textContent?.trim() || "?";
    const text = cardNodes().map((card) => normalize(card.innerText || card.textContent || "")).join("||");
    return `${level}:${text}`;
  }

  function scoredCandidateSignature(candidates) {
    const scores = candidates.map((candidate) => `${normalize(candidate.text)}=${candidate.score}:${normalize(candidate.reasons.join(" "))}`).join("||");
    return `${cardSelectionSignature()}::${scores}`;
  }

  function scheduleAutoPick(candidates) {
    const cardSignature = cardSelectionSignature();
    const planSignature = scoredCandidateSignature(candidates);
    if (!state.autoPick || !isLevelUpVisible) {
      if (autoPickTimer) clearTimeout(autoPickTimer);
      autoPickTimer = null;
      pendingAutoPickSignature = "";
      ui.autoStatus.textContent = state.autoPick ? "Đang chờ thẻ lên cấp." : "Tự chọn đang tắt; extension vẫn xếp hạng và theo dõi lựa chọn.";
      return;
    }
    if (autoPickTimer && pendingAutoPickSignature === planSignature) return;
    if (autoPickTimer) clearTimeout(autoPickTimer);
    autoPickTimer = null;
    pendingAutoPickSignature = "";
    if (!candidates.length) {
      ui.autoStatus.textContent = "Đang chờ nội dung thẻ lên cấp.";
      return;
    }
    if (autoPickSignature === cardSignature) {
      ui.autoStatus.textContent = "Đã ghi nhận lựa chọn ở cấp này.";
      return;
    }

    const best = candidates[0];
    ui.autoStatus.textContent = `Sẽ tự chọn hạng 1: ${best.move?.name || best.text.slice(0, 32)} (${best.score}đ).`;
    pendingAutoPickSignature = planSignature;
    attemptAutoPick(0);

    function attemptAutoPick(attempt) {
      autoPickTimer = setTimeout(() => {
        autoPickTimer = null;
        pendingAutoPickSignature = "";
        const currentScreen = document.querySelector("#scr-levelup");
        const currentCandidates = rankCurrentCandidates();
        if (!state.autoPick || !isLevelUpVisible || !isScreenVisible(currentScreen) || scoredCandidateSignature(currentCandidates) !== planSignature) return;
        const currentBest = currentCandidates[0];
        if (!currentBest?.element?.isConnected) return;
        if (!isGameCardReady(currentBest.element)) {
          if (attempt < AUTO_PICK_MAX_RETRIES) {
            ui.autoStatus.textContent = "Đang chờ game mở khóa thẻ rồi sẽ tự chọn…";
            pendingAutoPickSignature = planSignature;
            attemptAutoPick(attempt + 1);
          } else {
            retryAutoPickAfterPause();
          }
          return;
        }

        currentBest.element.click();
        const currentCardsRoot = document.querySelector("#cards");
        const accepted = !isScreenVisible(currentScreen)
          || currentCardsRoot?.classList.contains("done")
          || Boolean(currentCardsRoot?.querySelector(".selected, .chosen, [aria-selected='true'], [data-selected='true']"))
          || cardSelectionSignature() !== cardSignature;
        if (!accepted) {
          if (attempt < AUTO_PICK_MAX_RETRIES) {
            ui.autoStatus.textContent = "Game chưa xác nhận lựa chọn; extension sẽ tự thử lại…";
            pendingAutoPickSignature = planSignature;
            attemptAutoPick(attempt + 1);
          } else {
            retryAutoPickAfterPause();
          }
          return;
        }
        autoPickSignature = cardSignature;
        trackGameSelection(currentBest);
        ui.autoStatus.textContent = `Đã tự chọn hạng 1: ${currentBest.move?.name || currentBest.text.slice(0, 32)} (${currentBest.score}đ).`;
        ui.status.textContent = `Game đã nhận thẻ phù hợp nhất cho ${state.pokemon || "Pokémon hiện tại"}.`;
      }, attempt === 0 ? AUTO_PICK_DELAY_MS : AUTO_PICK_RETRY_MS);
    }

    function retryAutoPickAfterPause() {
      ui.autoStatus.textContent = "Đang tiếp tục chờ game xác nhận thẻ ưu tiên số 1…";
      pendingAutoPickSignature = planSignature;
      autoPickTimer = setTimeout(() => {
        autoPickTimer = null;
        pendingAutoPickSignature = "";
        if (!state.autoPick || !isLevelUpVisible) return;
        const freshCandidates = rankCurrentCandidates();
        if (!freshCandidates.length || scoredCandidateSignature(freshCandidates) !== planSignature) return;
        scheduleAutoPick(freshCandidates);
      }, 1200);
    }
  }

  function isGameCardReady(card) {
    if (!card?.isConnected || card.matches(":disabled") || card.getAttribute("aria-disabled") === "true") return false;
    if (card.closest("[disabled], [aria-disabled='true'], .disabled, .locked, .unavailable")) return false;
    return getComputedStyle(card).pointerEvents !== "none";
  }

  function fusionPairScore(moveA, moveB, pokemonOverride = null) {
    const profileA = moveProfile(moveA);
    const profileB = moveProfile(moveB);
    let score = 0;
    const reasons = [];
    const attackingA = !profileA.isBuff;
    const attackingB = !profileB.isBuff;
    if (profileA.category && profileA.category === profileB.category) {
      score += 7;
      reasons.push(`cùng tận dụng chỉ số ${profileA.category === "Physical" ? "vật lý" : "đặc biệt"}`);
    }
    const buffPair = profileA.isBuff ? [profileA, profileB] : profileB.isBuff ? [profileB, profileA] : null;
    if (buffPair?.[0].buffTarget && buffPair[0].buffTarget === buffPair[1].category) {
      score += 16;
      reasons.push("buff khớp đòn tấn công trong cùng nhóm");
    }
    if (attackingA && attackingB && profileA.area !== profileB.area) {
      score += 8;
      reasons.push("cân bằng diện rộng và nhắm mục tiêu");
    }
    if ((profileA.control && attackingB) || (profileB.control && attackingA)) {
      score += 7;
      reasons.push("khống chế hỗ trợ move gây sát thương");
    }
    const hex = normalize(moveA.name) === "hex" ? moveA : normalize(moveB.name) === "hex" ? moveB : null;
    const other = hex === moveA ? moveB : moveA;
    if (hex && moveProfile(other).statuses.some((status) => ["burn", "poison", "slow"].includes(status))) {
      score += 18;
      reasons.push("kích hoạt thêm sát thương của Hex");
    }
    if ((profileA.sustain && attackingB) || (profileB.sustain && attackingA)) {
      score += 5;
      reasons.push("hồi phục đi cùng sát thương");
    }
    const pokemon = pokemonOverride || currentPokemon();
    const moveATypeMatches = pokemon?.types.some((type) => normalize(type) === normalize(moveA.type));
    const moveBTypeMatches = pokemon?.types.some((type) => normalize(type) === normalize(moveB.type));
    if (moveATypeMatches && moveBTypeMatches) {
      score += 6;
      reasons.push(`cùng hệ Partner ${moveA.type}`);
    }
    if (profileA.isBuff && profileB.isBuff) {
      score -= 8;
      reasons.push("cặp này thiếu đòn gây sát thương trực tiếp");
    }
    return { score, reasons: reasons.slice(0, 3) };
  }

  function markMovesFused(names) {
    const normalizedNames = names.map(normalize);
    const involved = state.fusedGroups.filter((group) => group.some((name) => normalizedNames.includes(normalize(name))));
    if (involved.length > 1) {
      ui.autoStatus.textContent = "Game chỉ cho thêm skill lẻ vào một nhóm Bond đang mở.";
      return;
    }
    const merged = [...new Set([...involved.flat(), ...names].map((name) => moveData.find((move) => normalize(move.name) === normalize(name))?.name || name))];
    if (merged.length > MAX_MOVE_SLOTS) {
      ui.autoStatus.textContent = "Một nhóm Bond tối đa 4 skill.";
      return;
    }
    state.fusedGroups = state.fusedGroups.filter((group) => !involved.includes(group));
    state.fusedGroups.push(merged);
    persistState();
    renderBuild();
  }

  function renderFusionSuggestions() {
    ui.fusions.replaceChildren();
    const moves = state.learnedMoves.map((item) => getMoveData(item.name)).filter(Boolean);
    const fusionCount = state.fusedGroups.reduce((total, group) => total + Math.max(0, group.length - 1), 0);
    ui.bondCount.textContent = state.fusedGroups.length ? `${fusionCount} Bond đã ghi` : `${moves.length} skill`;
    if (moves.length < 2) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Học thêm skill để xem các cặp kết hợp.";
      ui.fusions.append(message);
      return;
    }
    const groupedNames = new Set(state.fusedGroups.flat().map(normalize));
    const loose = moves.filter((move) => !groupedNames.has(normalize(move.name)));
    const growingGroup = state.fusedGroups.find((group) => group.length > 1 && group.length < MAX_MOVE_SLOTS);
    const options = [];
    if (growingGroup && loose.length) {
      const groupMoves = growingGroup.map(getMoveData).filter(Boolean);
      for (const add of loose) {
        const matches = groupMoves.map((move) => fusionPairScore(move, add));
        options.push({ group: [...growingGroup], add, score: Math.round(matches.reduce((sum, item) => sum + item.score, 0) / matches.length), reasons: [...new Set(matches.flatMap((item) => item.reasons))].slice(0, 3) });
      }
    } else if (!growingGroup) {
      for (let i = 0; i < loose.length; i += 1) {
        for (let j = i + 1; j < loose.length; j += 1) {
          const result = fusionPairScore(loose[i], loose[j]);
          options.push({ group: [loose[i].name], add: loose[j], ...result });
        }
      }
    }
    options.sort((a, b) => b.score - a.score);
    if (!options.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = growingGroup
        ? "Nhóm Bond đang chờ một skill lẻ để ghép thêm."
        : loose.length < 2
          ? "Cần hai skill chưa ghép để dùng Bond tiếp theo."
          : "Các skill đã được đánh dấu trong nhóm Bond.";
      ui.fusions.append(message);
      return;
    }
    for (const option of options.slice(0, 3)) {
      const row = document.createElement("div");
      row.className = "recommendation";
      const title = document.createElement("div");
      title.className = "recommendation-head";
      const names = document.createElement("strong");
      names.textContent = `${option.group.join(" + ")} + ${option.add.name}`;
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = `${option.score}đ`;
      title.append(names, score);
      const reason = document.createElement("p");
      reason.textContent = option.reasons.join(" · ") || "Các move trong nhóm cùng kích hoạt khi ghép Bond.";
      const mark = document.createElement("button");
      mark.type = "button";
      mark.className = "text-button fusion-mark";
      mark.textContent = "Đánh dấu đã ghép";
      mark.addEventListener("click", () => markMovesFused([...option.group, option.add.name]));
      row.append(title, reason, mark);
      ui.fusions.append(row);
    }
  }

  function renderRecommendations(candidates, hasClearRecommendation) {
    ui.recommendations.replaceChildren();
    if (!isLevelUpVisible || !candidates.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = isLevelUpVisible ? "Chưa đọc được nội dung thẻ. Gợi ý sẽ hiện khi game cập nhật danh sách." : "Khi màn hình chọn thẻ xuất hiện, gợi ý sẽ hiện ở đây.";
      ui.recommendations.append(message);
      return;
    }
    if (!hasClearRecommendation) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Chưa khớp dữ liệu chi tiết; extension vẫn xếp hạng theo điểm nền và thứ tự thẻ trong game.";
      ui.recommendations.append(message);
      for (const candidate of candidates) {
        const fallback = document.createElement("div");
        fallback.className = "recommendation";
        fallback.textContent = `${candidate.choiceIndex + 1}. ${candidate.text.slice(0, 80) || "Lựa chọn chưa nhận diện"} · ${candidate.score}đ`;
        ui.recommendations.append(fallback);
      }
      return;
    }
    for (const [index, candidate] of candidates.slice(0, 3).entries()) {
      const row = document.createElement("div");
      row.className = `recommendation ${index === 0 ? "best" : ""}`;
      const title = document.createElement("div");
      title.className = "recommendation-head";
      const name = document.createElement("strong");
      name.textContent = candidate.move?.name || candidate.text.slice(0, 76) || "Lựa chọn";
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = `${candidate.score}đ`;
      title.append(name, score);
      const reason = document.createElement("p");
      reason.textContent = candidate.reasons.slice(0, 3).join(" · ");
      row.append(title, reason);
      ui.recommendations.append(row);
    }
  }

  function onGameCardClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest("#cards .card") || target?.closest('#cards button, #cards [role="button"]') || target?.closest("#cards > *");
    const cardsRoot = document.querySelector("#cards");
    if (!card || !cardsRoot?.contains(card) || !event.isTrusted) return;
    stopAutoPickForManualChoice();
    trackGameSelection(candidateFromCard(card));
  }

  function onGameLevelUpKeydown(event) {
    if (!isLevelUpVisible || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.composedPath().includes(host)) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const index = { "1": 0, "2": 1, "3": 2 }[event.key];
    if (index === undefined) return;
    const card = cardNodes()[index];
    if (!card) return;
    if (event.isTrusted) stopAutoPickForManualChoice();
    trackGameSelection(candidateFromCard(card));
  }

  function stopAutoPickForManualChoice() {
    if (autoPickTimer) clearTimeout(autoPickTimer);
    autoPickTimer = null;
    pendingAutoPickSignature = "";
    autoPickSignature = cardSelectionSignature();
  }

  function trackGameSelection(candidate) {
    const signature = cardSelectionSignature();
    const now = Date.now();
    if (signature === lastTrackedSelectionSignature && now - lastTrackedSelectionAt < 800) return;
    lastTrackedSelectionSignature = signature;
    lastTrackedSelectionAt = now;
    if (candidate.evolution) {
      const matched = state.learnedMoves.find((move) => candidate.normalizedText.includes(normalize(move.name)));
      if (matched) matched.evolved = true;
    } else if (candidate.move) {
      const existing = state.learnedMoves.find((move) => normalize(move.name) === normalize(candidate.move.name));
      if (existing) existing.level = Math.min(5, Number(existing.level || 1) + 1);
      else if (state.learnedMoves.length < MAX_MOVES_WITH_BONDS) state.learnedMoves.push({ name: candidate.move.name, level: 1, evolved: false });
    } else if (candidate.stat) {
      state.statPicks.push(candidate.stat);
      state.statPicks = state.statPicks.slice(-12);
    }
    persistState();
    renderBuild();
    refreshRecommendations();
    renderTmRecommendations();
  }

  function renderBuild() {
    ui.build.replaceChildren();
    if (!state.learnedMoves.length && !state.statPicks.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Chưa ghi nhận lựa chọn nào.";
      ui.build.append(empty);
      renderFusionSuggestions();
      return;
    }
    for (const move of state.learnedMoves) {
      const row = document.createElement("div");
      row.className = "build-item";
      const name = document.createElement("span");
      name.textContent = move.name;
      const level = document.createElement("span");
      level.className = "build-level";
      level.textContent = move.evolved ? "Đã tiến hóa" : `Lv ${move.level || 1}/5`;
      row.append(name, level);
      ui.build.append(row);
    }
    if (state.statPicks.length) {
      const stats = document.createElement("p");
      stats.className = "muted stat-history";
      stats.textContent = `Stat gần đây: ${state.statPicks.slice(-5).join(", ")}`;
      ui.build.append(stats);
    }
    for (const group of state.fusedGroups) {
      const fusion = document.createElement("p");
      fusion.className = "muted stat-history";
      fusion.textContent = `Bond: ${group.join(" + ")}`;
      ui.build.append(fusion);
    }
    renderFusionSuggestions();
  }

  function setPanelOpen(open) {
    panelOpen = Boolean(open);
    ui.panel.classList.toggle("open", panelOpen);
    ui.fab.classList.toggle("visible", !panelOpen);
  }

  const PANEL_CSS = `
    :host { all: initial; color-scheme: dark; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    * { box-sizing: border-box; }
    .panel { position: fixed; z-index: 2147483646; top: 14px; right: 14px; width: min(318px, calc(100vw - 24px)); max-height: min(78vh, 720px); overflow: hidden; display: none; color: #eef4ff; background: #101827; border: 1px solid #394760; border-radius: 14px; box-shadow: 0 16px 48px #0009; font-size: 13px; }
    .panel.open { display: flex; flex-direction: column; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: linear-gradient(120deg, #1d2a40, #172031); border-bottom: 1px solid #394760; }
    .header strong { display: block; font-size: 16px; letter-spacing: .1px; }
    .eyebrow { color: #f5c76b; font-size: 9px; font-weight: 800; letter-spacing: 1.4px; margin-bottom: 2px; }
    .icon-button, .quiet-button, .text-button, .chip { font: inherit; cursor: pointer; }
    .icon-button { width: 28px; height: 28px; border: 1px solid #53617a; border-radius: 8px; background: #27364b; color: white; font-size: 18px; line-height: 1; }
    .body { overflow: auto; padding: 12px; }
    .status { margin: 0 0 12px; color: #9fb1cc; font-size: 11px; line-height: 1.45; }
    label, .section-title { display: flex; align-items: center; justify-content: space-between; margin: 10px 0 6px; font-size: 11px; font-weight: 750; color: #c9d6e9; }
    input, select { width: 100%; min-width: 0; height: 34px; border: 1px solid #45556f; border-radius: 8px; padding: 0 9px; color: #eef4ff; background: #172235; font: inherit; outline: none; }
    input:focus, select:focus { border-color: #f5c76b; box-shadow: 0 0 0 2px #f5c76b30; }
    .pokemon-row, .target-row { display: flex; gap: 6px; }
    .owned-row { display: flex; gap: 5px; margin-top: 7px; }
    .owned-row input:first-child { flex: 1 1 auto; width: 100%; }
    .owned-row .known-level-input { flex: 0 0 45px; width: 45px; padding: 0 5px; }
    .quiet-button { flex: 0 0 auto; border: 1px solid #52617a; border-radius: 8px; background: #25334a; color: #e9f1ff; padding: 0 9px; }
    .types { min-height: 26px; display: flex; align-items: center; gap: 6px; margin: 5px 0 8px; }
    .partner-details { margin: -3px 0 7px; line-height: 1.4; }
    .coin-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 3px 0 6px; padding: 6px 8px; border: 1px solid #344157; border-radius: 8px; background: #172235; color: #c9d6e9; font-size: 11px; }
    .coin-row strong { color: #f5c76b; font-size: 12px; }
    .tm-budget { padding: 7px 8px; border: 1px solid #5b5035; border-radius: 8px; color: #f5d48e; background: #2a281f; font-size: 10px; line-height: 1.4; }
    .tm-help { margin: 2px 0 0; line-height: 1.4; }
    .tm-action-row, .tm-target-row { display: flex; align-items: center; gap: 6px; margin: 5px 0; }
    .tm-action-row .quiet-button { min-height: 30px; }
    .tm-action-row .muted { flex: 1; margin: 0; font-size: 10px; }
    .tm-target-row input { flex: 1 1 auto; width: 100%; }
    .tm-target-row .quiet-button { min-height: 34px; }
    .tm-inventory { display: grid; gap: 4px; margin: 5px 0 8px; }
    .tm-inventory-item { display: flex; justify-content: space-between; gap: 8px; padding: 5px 7px; border-radius: 7px; background: #172235; font-size: 10px; }
    .tm-inventory-item span { color: #f5c76b; font-weight: 750; white-space: nowrap; }
    .tm-candidate-row { display: flex; gap: 5px; margin: 5px 0 2px; }
    .tm-candidate-row select { flex: 0 0 46%; width: 46%; min-width: 0; height: 34px; padding: 0 5px; font-size: 10px; }
    .tm-candidate-row input { flex: 1 1 auto; width: 100%; min-width: 0; font-size: 10px; }
    .tm-candidates { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 3px 0 8px; }
    .tm-source-links { display: flex; flex-wrap: wrap; gap: 5px 9px; margin: 5px 0 9px; font-size: 10px; line-height: 1.35; }
    .tm-source-links a, .tm-help a { color: #9cc4ff; text-decoration: underline; text-underline-offset: 2px; }
    .type-pill { border-radius: 999px; background: #31415c; color: #dceaff; padding: 3px 8px; font-size: 10px; font-weight: 700; }
    .muted, .section-title small { color: #9baac0; font-size: 11px; }
    .auto-pick-row { justify-content: flex-start; margin: 9px 0 2px; cursor: pointer; }
    .auto-pick-row span { display: flex; align-items: center; gap: 8px; }
    .auto-pick-row input { width: 15px; height: 15px; margin: 0; padding: 0; accent-color: #f5c76b; }
    .auto-status { margin: 0 0 6px; font-size: 10px; line-height: 1.35; }
    .section-title { margin-top: 13px; }
    .section-title small { font-weight: 500; }
    .text-button { border: 0; color: #f1c66b; background: transparent; padding: 0; font-size: 10px; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
    .chips.empty { display: block; color: #8e9db3; font-size: 11px; }
    .chip { border: 1px solid #53617a; border-radius: 999px; background: #25334a; color: #e9f1ff; padding: 4px 8px; font-size: 10px; }
    .recommendations, .build-list { display: grid; gap: 6px; }
    .recommendation { padding: 8px 9px; border: 1px solid #394760; border-radius: 9px; background: #172235; }
    .recommendation.best { border-color: #c49b45; background: #2a281f; }
    .recommendation-head { display: flex; gap: 8px; justify-content: space-between; align-items: flex-start; }
    .recommendation-head strong { font-size: 12px; line-height: 1.3; }
    .score { flex: 0 0 auto; color: #f5c76b; font-size: 10px; font-weight: 800; }
    .recommendation p { margin: 4px 0 0; color: #aebbd0; font-size: 10px; line-height: 1.35; }
    .fusion-mark { display: block; margin: 5px 0 0 auto; }
    .build-item { display: flex; justify-content: space-between; gap: 8px; padding: 5px 7px; background: #172235; border-radius: 7px; font-size: 11px; }
    .build-level { color: #b8c9e1; white-space: nowrap; }
    .stat-history { margin: 3px 0 0; }
    .footnote { margin: 12px 0 0; padding-top: 9px; border-top: 1px solid #344157; color: #8796ad; font-size: 10px; line-height: 1.4; }
    .fab { position: fixed; z-index: 2147483646; right: 14px; bottom: 16px; display: none; width: 42px; height: 42px; border: 2px solid #f5c76b; border-radius: 50%; background: #152137; color: #f5c76b; font-weight: 900; box-shadow: 0 5px 18px #0008; cursor: pointer; }
    .fab.visible { display: block; }
    @media (max-width: 700px) { .panel { top: auto; bottom: 10px; right: 10px; width: min(320px, calc(100vw - 20px)); max-height: 55vh; } .fab { right: 10px; bottom: 10px; } }
  `;
  const panelStyle = document.createElement("style");
  panelStyle.textContent = PANEL_CSS;
  shadow.prepend(panelStyle);
  }
})();
