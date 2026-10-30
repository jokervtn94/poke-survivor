(() => {
  "use strict";

  if (!document.querySelector("#game") || !document.querySelector("#scr-levelup") || !document.querySelector("#cards")) return;

  const STATE_KEY = "psba_player_state_v1";
  const MAX_MOVE_SLOTS = 4;
  const MAX_MOVES_WITH_BONDS = 16;
  const AUTO_PICK_MIN_SCORE = 6;
  const AUTO_PICK_NEAR_TIE_GAP = 6;
  const AUTO_PICK_DELAY_MS = 750;
  const AUTO_BOND_DELAY_MS = 500;
  const AUTO_ITEM_DELAY_MS = 600;
  const DODGE_SCAN_INTERVAL_MS = 160;
  const DODGE_MOVE_PULSE_MS = 220;
  const EVO_STATS = ["Power", "Vigor", "Reflexes", "Armor", "Synthesis", "Magnet", "Sprint"];
  const STRATEGIES = {
    balanced: "Cân bằng",
    evolve: "Ưu tiên tiến hóa",
    physical: "Thiên vật lý",
    special: "Thiên đặc biệt",
    survival: "Sinh tồn"
  };
  const ITEM_DEFINITIONS = [
    { id: "leftovers", name: "Leftovers", aliases: ["leftovers", "restos", "restes"], effects: [/recover.*hp per second/, /heal.*hp per second/, /recupera.*hp/ ] },
    { id: "choice-band", name: "Choice Band", aliases: ["choice band", "banda elegida", "bandeau choix", "faixa escolha"], effects: [/40 damage.*can t switch/, /40.*damage.*switch moves/] },
    { id: "quick-claw", name: "Quick Claw", aliases: ["quick claw", "garra rapida", "griffe rapide", "rapidartigli"], effects: [/cooldown on all moves/, /20 cooldown/, /reduce.*cooldown/] },
    { id: "focus-sash", name: "Focus Sash", aliases: ["focus sash", "banda focus", "ceinture force", "faixa focus"], effects: [/leaves you at 1 hp/, /hit.*knock you out.*1 hp/] },
    { id: "shell-bell", name: "Shell Bell", aliases: ["shell bell", "campana concha", "coquille sable", "conchinella"], effects: [/heal from the damage you deal/, /heal.*damage you deal/] },
    { id: "amulet-coin", name: "Amulet Coin", aliases: ["amulet coin", "moneda amuleto", "piece rune", "moeda amuleto"], effects: [/50 pokecoins/, /pokecoins at the end/, /coin.*end of the run/] },
    { id: "lucky-egg", name: "Lucky Egg", aliases: ["lucky egg", "huevo suerte", "oeuf chance", "fortunuovo", "ovo sorte"], effects: [/30 experience/, /experience/, /experiencia/] },
    { id: "life-orb", name: "Life Orb", aliases: ["life orb", "vidasfera", "orbe vie", "orbe da vida"], effects: [/30 damage.*attack costs/, /each attack costs.*hp/, /attacks cost.*hp/] },
    { id: "choice-scarf", name: "Choice Scarf", aliases: ["choice scarf", "panuelo elegido", "mouchoir choix", "stolascelta", "lenco escolha"], effects: [/35 speed/, /35.*speed/] },
    { id: "rocky-helmet", name: "Rocky Helmet", aliases: ["rocky helmet", "casco dentado", "casque brut", "casco duro"], effects: [/foes that hit you in melee take damage/, /enemies that hit you in melee/] },
    { id: "assault-vest", name: "Assault Vest", aliases: ["assault vest", "chaleco asalto", "veste combat", "corpetto assalto", "colete assalto"], effects: [/20 damage reduction/, /damage reduction/] }
  ];

  const state = {
    pokemon: "",
    manualPokemon: false,
    strategy: "balanced",
    autoPick: true,
    autoBuildFromMoveset: false,
    autoBondFromMoveset: false,
    autoPickItems: true,
    targets: [],
    partnerBuild: null,
    learnedMoves: [],
    fusedGroups: [],
    statPicks: [],
    heldItem: "",
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
  let isBondVisible = false;
  let bondAutoTimer = null;
  let bondWatchdogTimer = null;
  let bondAttemptSignature = "";
  let bondPendingFirstMove = "";
  let bondPendingSecondMove = "";
  let bondPendingStartedAt = 0;
  let bondManualOverride = false;
  let isItemVisible = false;
  let itemAutoTimer = null;
  let itemWatchdogTimer = null;
  let itemAttemptSignature = "";
  let pendingItemName = "";
  let itemManualOverride = false;
  let lastBuildFetchPokemon = "";
  let buildFetchInFlight = "";
  let lastTrackedSelectionSignature = "";
  let lastTrackedSelectionAt = 0;
  let autoDodgeEnabled = false;
  let dodgeScanTimer = null;
  let dodgeMoveTimer = null;
  let dodgeHeldKeys = [];
  let dodgeThreatMissingAt = 0;
  let dodgeThreatHandled = false;
  let dodgeManualPauseUntil = 0;

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

        <div class="section-title"><span>Move set gợi ý cho Partner</span><button id="psba-load-moveset" class="text-button" type="button">Tải gợi ý</button></div>
        <div id="psba-moveset" class="moveset-list"><p class="muted">Chọn Partner để tải move set tham khảo.</p></div>
        <label class="auto-pick-row"><span><input id="psba-auto-build" type="checkbox" disabled> Tự build theo move set</span></label>
        <p id="psba-build-mode-status" class="muted auto-status">Tắt chế độ tự build.</p>

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
        <label class="auto-pick-row"><span><input id="psba-auto-pick" type="checkbox"> Tự chọn thẻ</span></label>
        <p id="psba-auto-status" class="muted auto-status">Tự chọn theo điểm; nếu chênh không quá 6 điểm thì ưu tiên move set hoặc skill mục tiêu.</p>

        <div class="section-title"><span>Item phù hợp cho lượt này</span><small id="psba-item-label">chờ item</small></div>
        <div id="psba-item-recommendations" class="recommendations"><p class="muted">Khi item xuất hiện, extension sẽ xếp hạng theo Partner và move set.</p></div>
        <label class="auto-pick-row"><span><input id="psba-auto-items" type="checkbox"> Tự chọn item</span></label>
        <p id="psba-item-status" class="muted auto-status">Đang ưu tiên hiệu quả cho Partner/build hiện tại.</p>

        <div class="section-title"><span>Né boss ở Vách Nứt</span><small>thử nghiệm</small></div>
        <label class="auto-pick-row"><span><input id="psba-auto-dodge" type="checkbox"> Tự né dải cảnh báo</span></label>
        <p id="psba-dodge-status" class="muted auto-status">Chỉ bật trong Vách Nứt. Nhận diện dải hồng giao nhau và gửi một nhịp né mỗi đợt.</p>

        <div class="section-title"><span>Skill đã học trong lượt</span><button id="psba-reset" class="text-button" type="button">Xóa lượt</button></div>
        <div id="psba-build" class="build-list"><p class="muted">Chưa ghi nhận lựa chọn nào.</p></div>
        <div class="owned-row">
          <input id="psba-known-move" list="psba-move-list" placeholder="Ghi nhận move khởi đầu / đã có" autocomplete="off">
          <input id="psba-known-level" class="known-level-input" type="number" min="1" max="5" value="1" aria-label="Cấp skill đã có">
          <button id="psba-add-known" class="quiet-button" type="button">Thêm</button>
        </div>
        <div class="section-title"><span>Gợi ý ghép Bond</span><small id="psba-bond-count">cần 2 skill</small></div>
        <label class="auto-pick-row"><span><input id="psba-auto-bond" type="checkbox" disabled> Tự chọn Bond theo move set</span></label>
        <p id="psba-bond-status" class="muted auto-status">Tải move set Partner để bật tự chọn Bond.</p>
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
    strategy: shadow.querySelector("#psba-strategy"),
    autoPick: shadow.querySelector("#psba-auto-pick"),
    autoStatus: shadow.querySelector("#psba-auto-status"),
    autoItems: shadow.querySelector("#psba-auto-items"),
    itemStatus: shadow.querySelector("#psba-item-status"),
    autoDodge: shadow.querySelector("#psba-auto-dodge"),
    dodgeStatus: shadow.querySelector("#psba-dodge-status"),
    itemLabel: shadow.querySelector("#psba-item-label"),
    itemRecommendations: shadow.querySelector("#psba-item-recommendations"),
    autoBuild: shadow.querySelector("#psba-auto-build"),
    buildModeStatus: shadow.querySelector("#psba-build-mode-status"),
    autoBond: shadow.querySelector("#psba-auto-bond"),
    bondStatus: shadow.querySelector("#psba-bond-status"),
    loadMoveset: shadow.querySelector("#psba-load-moveset"),
    moveset: shadow.querySelector("#psba-moveset"),
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
  });
  ui.autoPick.addEventListener("change", () => {
    state.autoPick = ui.autoPick.checked;
    persistState();
    refreshRecommendations();
  });
  ui.autoItems.addEventListener("change", () => {
    state.autoPickItems = ui.autoItems.checked;
    if (itemAutoTimer) clearTimeout(itemAutoTimer);
    itemAutoTimer = null;
    itemAttemptSignature = "";
    itemManualOverride = false;
    persistState();
    ui.itemStatus.textContent = state.autoPickItems
      ? "Đang tự chọn item theo hiệu quả ước tính cho Partner/build."
      : "Tự chọn item đang tắt; extension vẫn xếp hạng để bạn chọn.";
    updateItemState();
  });
  ui.autoDodge.addEventListener("change", () => {
    autoDodgeEnabled = ui.autoDodge.checked;
    dodgeThreatMissingAt = 0;
    dodgeThreatHandled = false;
    dodgeManualPauseUntil = 0;
    if (autoDodgeEnabled) {
      ui.dodgeStatus.textContent = "Đang theo dõi cảnh báo dạng dải. Chỉ bật trong Vách Nứt.";
      startDodgeMonitor();
    } else {
      stopDodgeMonitor();
      ui.dodgeStatus.textContent = "Tự né đang tắt.";
    }
  });
  ui.autoBuild.addEventListener("change", () => {
    state.autoBuildFromMoveset = Boolean(ui.autoBuild.checked && hasPartnerBuildForCurrentPokemon());
    ui.autoBuild.checked = state.autoBuildFromMoveset;
    persistState();
    renderPartnerBuild();
    refreshRecommendations();
  });
  ui.autoBond.addEventListener("change", () => {
    state.autoBondFromMoveset = Boolean(ui.autoBond.checked && hasPartnerBuildForCurrentPokemon());
    ui.autoBond.checked = state.autoBondFromMoveset;
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    bondAutoTimer = null;
    bondAttemptSignature = "";
    bondManualOverride = false;
    persistState();
    ui.bondStatus.textContent = state.autoBondFromMoveset
      ? "Đang chờ Bond; dùng cặp trong build hoặc chấm phối hợp các move của Partner."
      : "Tắt tự chọn Bond; bạn vẫn có thể xem gợi ý và ghép thủ công.";
    updateBondState();
  });
  ui.loadMoveset.addEventListener("click", () => loadPartnerMoveset(true));
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
  ui.autoItems.checked = state.autoPickItems;

  const cardsRoot = document.querySelector("#cards");
  const bondCardsRoot = document.querySelector("#bond-cards");
  const itemCardsRoot = document.querySelector("#item-cards");
  cardsRoot.addEventListener("click", onGameCardClick, true);
  bondCardsRoot?.addEventListener("click", onGameBondCardClick, true);
  itemCardsRoot?.addEventListener("click", onGameItemCardClick, true);
  document.addEventListener("keydown", onGameLevelUpKeydown, true);
  document.addEventListener("keydown", onManualMovementKeydown, true);
  document.addEventListener("keyup", onManualMovementKeyup, true);
  window.addEventListener("blur", releaseDodgeKeys);
  document.addEventListener("visibilitychange", onDodgeVisibilityChange);
  const observer = new MutationObserver(() => {
    observePartnerName();
    updateLevelUpState();
    updateBondState();
    updateItemState();
    updateGameOverState();
  });
  for (const selector of ["#cards", "#scr-levelup", "#scr-bond", "#bond-sub", "#bond-cards", "#scr-item", "#item-cards", "#scr-over", "#menu-partner-name", "#res-name", "#starter-info"]) {
    const element = document.querySelector(selector);
    if (element) observer.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "data-id", "data-move", "data-item", "title", "aria-label"] });
  }

  setPanelOpen(false);
  loadStoredState();
  loadReferenceData();
  observePartnerName();
  updateLevelUpState();
  updateBondState();
  updateItemState();
  updateGameOverState();

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
      autoBuildFromMoveset: state.autoBuildFromMoveset,
      autoBondFromMoveset: state.autoBondFromMoveset,
      autoPickItems: state.autoPickItems,
      targets: [...state.targets],
      partnerBuild: state.partnerBuild ? {
        pokemon: state.partnerBuild.pokemon,
        url: state.partnerBuild.url,
        moves: state.partnerBuild.moves.map((move) => ({ ...move })),
        cardPriority: [...state.partnerBuild.cardPriority],
        bondGroups: state.partnerBuild.bondGroups.map((group) => [...group])
      } : null,
      learnedMoves: state.learnedMoves.map((move) => ({ ...move })),
      fusedGroups: state.fusedGroups.map((group) => [...group]),
      statPicks: [...state.statPicks],
      heldItem: state.heldItem,
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
        state.autoBuildFromMoveset = Boolean(value.autoBuildFromMoveset);
        state.autoBondFromMoveset = Boolean(value.autoBondFromMoveset);
        state.autoPickItems = value.autoPickItems === undefined ? true : Boolean(value.autoPickItems);
        state.targets = Array.isArray(value.targets) ? value.targets.filter((item) => typeof item === "string") : [];
        state.partnerBuild = value.partnerBuild && typeof value.partnerBuild.pokemon === "string" && Array.isArray(value.partnerBuild.moves)
          ? {
              pokemon: value.partnerBuild.pokemon,
              url: typeof value.partnerBuild.url === "string" ? value.partnerBuild.url : "",
              moves: value.partnerBuild.moves.filter((move) => move && typeof move.name === "string").slice(0, MAX_MOVE_SLOTS).map((move) => ({
                name: move.name,
                role: typeof move.role === "string" ? move.role : "",
                evolves: typeof move.evolves === "string" ? move.evolves : ""
              })),
              cardPriority: Array.isArray(value.partnerBuild.cardPriority)
                ? value.partnerBuild.cardPriority.filter((item) => typeof item === "string").slice(0, 8)
                : [],
              bondGroups: Array.isArray(value.partnerBuild.bondGroups)
                ? value.partnerBuild.bondGroups.map((group) => Array.isArray(group) ? group.filter((name) => typeof name === "string").slice(0, MAX_MOVE_SLOTS) : []).filter((group) => group.length >= 2).slice(0, 4)
                : []
            }
          : null;
        state.learnedMoves = Array.isArray(value.learnedMoves) ? value.learnedMoves.filter((item) => item && typeof item.name === "string").slice(0, MAX_MOVES_WITH_BONDS) : [];
        state.fusedGroups = Array.isArray(value.fusedGroups)
          ? value.fusedGroups.map((group) => Array.isArray(group) ? group.filter((name) => typeof name === "string").slice(0, MAX_MOVE_SLOTS) : []).filter((group) => group.length >= 2).slice(0, MAX_MOVE_SLOTS)
          : [];
        state.statPicks = Array.isArray(value.statPicks) ? value.statPicks.filter((item) => typeof item === "string").slice(-12) : [];
        state.heldItem = typeof value.heldItem === "string" ? value.heldItem : "";
        state.lastLevel = Number.isFinite(Number(value.lastLevel)) ? Number(value.lastLevel) : 0;
        if (!hasPartnerBuildForCurrentPokemon()) {
          state.autoBuildFromMoveset = false;
          state.autoBondFromMoveset = false;
        }
      }
      syncUiFromState();
      loadPartnerMovesetIfNeeded();
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
      syncUiFromState();
      observePartnerName();
      loadPartnerMovesetIfNeeded();
      ui.status.textContent = `Đã nạp ${pokemonData.length} Pokémon và ${moveData.length} move từ trang chính thức.`;
      refreshRecommendations();
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
    ui.autoItems.checked = state.autoPickItems;
    renderTypes();
    renderTargets();
    renderBuild();
    renderPartnerBuild();
  }

  function currentPokemon() {
    const key = normalize(state.pokemon);
    return pokemonData.find((pokemon) => normalize(pokemon.name) === key) || null;
  }

  function hasPartnerBuildForCurrentPokemon() {
    return Boolean(state.partnerBuild && normalize(state.partnerBuild.pokemon) === normalize(state.pokemon) && state.partnerBuild.moves.length);
  }

  function setPartnerPokemon(name, manual = false) {
    const nextPokemon = String(name || "").trim();
    const changed = normalize(state.pokemon) !== normalize(nextPokemon);
    if (changed) {
      clearRunTracker();
      state.partnerBuild = null;
      state.autoBuildFromMoveset = false;
      state.autoBondFromMoveset = false;
      lastBuildFetchPokemon = "";
    }
    state.pokemon = nextPokemon;
    state.manualPokemon = manual;
    ui.pokemon.value = nextPokemon;
    persistState();
    renderTypes();
    renderTargets();
    renderPartnerBuild();
    refreshRecommendations();
    loadPartnerMovesetIfNeeded();
  }

  function onPokemonInput() {
    setPartnerPokemon(ui.pokemon.value, true);
  }

  function observePartnerName() {
    if (!pokemonData.length) return;
    const candidates = ["#menu-partner-name", "#res-name", "#starter-info"];
    for (const selector of candidates) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (!text) continue;
      const match = findPokemonInText(text);
      if (!match || match.name === lastAutoName) continue;
      lastAutoName = match.name;
      if (!state.manualPokemon || !state.pokemon) {
        setPartnerPokemon(match.name, false);
      }
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
      lastAutoName = match.name;
      setPartnerPokemon(match.name, false);
      return;
    }
    ui.status.textContent = "Chưa đọc được tên Pokémon trong menu game. Hãy chọn hoặc nhập tên ở ô trên.";
  }

  function loadPartnerMovesetIfNeeded() {
    if (!state.pokemon || !moveData.length) return;
    if (hasPartnerBuildForCurrentPokemon()) {
      renderPartnerBuild();
      return;
    }
    loadPartnerMoveset(false);
  }

  async function loadPartnerMoveset(force = false) {
    const pokemonName = state.pokemon.trim();
    const pokemonKey = normalize(pokemonName);
    if (!pokemonKey) {
      ui.moveset.replaceChildren();
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Hãy chọn Pokémon Partner trước.";
      ui.moveset.append(message);
      return;
    }
    if (!moveData.length) {
      ui.buildModeStatus.textContent = "Đang tải dữ liệu move; gợi ý sẽ được tải sau.";
      return;
    }
    if (buildFetchInFlight === pokemonKey) return;
    if (!force && (lastBuildFetchPokemon === pokemonKey || hasPartnerBuildForCurrentPokemon())) return;

    const slug = pokemonKey.replace(/\s+/g, "-");
    buildFetchInFlight = pokemonKey;
    lastBuildFetchPokemon = pokemonKey;
    ui.loadMoveset.disabled = true;
    ui.loadMoveset.textContent = "Đang tải…";
    ui.buildModeStatus.textContent = `Đang tải move set tham khảo cho ${pokemonName}…`;
    try {
      const response = await chrome.runtime.sendMessage({ type: "psba:get-partner-build", slug });
      if (!response || response.error) throw new Error(response?.error || "Không lấy được trang build.");
      const build = parsePartnerBuild(response.html, pokemonName, response.url || `https://pokesurvivors.org/builds/${slug}/`);
      if (!build.moves.length) throw new Error("Trang build không có move set đọc được cho Pokémon này.");
      if (normalize(state.pokemon) !== pokemonKey) return;
      state.partnerBuild = build;
      persistState();
      renderPartnerBuild();
      refreshRecommendations();
      ui.buildModeStatus.textContent = `Đã nạp ${build.moves.length} move tham khảo cho ${pokemonName}.`;
    } catch (error) {
      if (normalize(state.pokemon) === pokemonKey) {
        ui.buildModeStatus.textContent = error?.message || "Không tải được move set. Có thể thử lại.";
      }
      lastBuildFetchPokemon = "";
    } finally {
      if (buildFetchInFlight === pokemonKey) buildFetchInFlight = "";
      ui.loadMoveset.disabled = false;
      ui.loadMoveset.textContent = "Tải gợi ý";
    }
  }

  function parsePartnerBuild(html, pokemonName, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ""), "text/html");
    const headings = Array.from(doc.querySelectorAll("h1, h2, h3"));
    const movesHeading = headings.find((heading) => /moves/.test(normalize(heading.textContent)) && /slot|move set|moveset/.test(normalize(heading.textContent)));
    const nextSection = (heading, selector) => {
      if (!heading) return null;
      for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
        if (/^H[1-3]$/.test(node.tagName)) break;
        if (node.matches(selector)) return node;
        const nested = node.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    };
    const moveTable = nextSection(movesHeading, "table") || Array.from(doc.querySelectorAll("table")).find((table) => /slot/.test(normalize(table.textContent)) && /move/.test(normalize(table.textContent)));
    const moves = [];
    for (const row of Array.from(moveTable?.querySelectorAll("tbody tr, tr") || [])) {
      const cells = Array.from(row.cells || []);
      if (cells.length < 2) continue;
      const moveCell = cells[1];
      const anchors = Array.from(moveCell.querySelectorAll("a")).map((anchor) => normalize(anchor.textContent));
      const cellText = normalize(moveCell.textContent);
      const move = moveData.find((item) => anchors.includes(normalize(item.name)))
        || moveData.find((item) => cellText === normalize(item.name) || cellText.startsWith(`${normalize(item.name)} `));
      if (!move || moves.some((item) => normalize(item.name) === normalize(move.name))) continue;
      moves.push({
        name: move.name,
        role: (cells[0]?.textContent || "").trim().replace(/^\s*\d+\s*/, "").trim(),
        evolves: (cells[4]?.textContent || "").trim()
      });
      if (moves.length >= MAX_MOVE_SLOTS) break;
    }

    const priorityHeading = headings.find((heading) => /level up card priority/.test(normalize(heading.textContent)));
    const priorityList = nextSection(priorityHeading, "ol, ul");
    const cardPriority = [];
    for (const item of Array.from(priorityList?.querySelectorAll("li") || [])) {
      const text = item.textContent || "";
      const stat = EVO_STATS.find((candidate) => normalize(text).includes(normalize(candidate)));
      if (stat && !cardPriority.includes(stat)) cardPriority.push(stat);
    }
    const bondGroups = [];
    const seenBondPairs = new Set();
    for (const node of Array.from(doc.querySelectorAll("li, p, blockquote"))) {
      const text = normalize(node.textContent);
      const actionAt = text.search(/\b(fuse|bond|combine|merge)\b/);
      if (actionAt < 0) continue;
      const clause = text.slice(actionAt).split(/[.!?;]/, 1)[0];
      const matches = moveData
        .map((move) => ({ move, at: clause.indexOf(normalize(move.name)), length: normalize(move.name).length }))
        .filter((item) => item.at >= 0)
        .sort((a, b) => a.at - b.at || b.length - a.length);
      const pair = [];
      const occupied = [];
      for (const item of matches) {
        if (occupied.some(([start, end]) => item.at < end && item.at + item.length > start)) continue;
        occupied.push([item.at, item.at + item.length]);
        if (!pair.some((move) => normalize(move.name) === normalize(item.move.name))) pair.push(item.move);
        if (pair.length === 2) break;
      }
      if (pair.length < 2) continue;
      const key = pair.map((move) => normalize(move.name)).sort().join("|");
      if (seenBondPairs.has(key)) continue;
      seenBondPairs.add(key);
      bondGroups.push(pair.map((move) => move.name));
      if (bondGroups.length >= 4) break;
    }
    return { pokemon: pokemonName, url, moves, cardPriority, bondGroups };
  }

  function renderPartnerBuild() {
    ui.moveset.replaceChildren();
    const matchingBuild = hasPartnerBuildForCurrentPokemon();
    ui.autoBuild.disabled = !matchingBuild;
    ui.autoBuild.checked = Boolean(matchingBuild && state.autoBuildFromMoveset);
    ui.autoBond.disabled = !matchingBuild;
    ui.autoBond.checked = Boolean(matchingBuild && state.autoBondFromMoveset);
    if (!state.pokemon) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Chọn Partner để tải move set tham khảo.";
      ui.moveset.append(message);
      ui.buildModeStatus.textContent = "Chưa chọn Partner.";
      return;
    }
    if (!matchingBuild) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = `Chưa có move set tải về cho ${state.pokemon}.`;
      ui.moveset.append(message);
      if (!ui.buildModeStatus.textContent.startsWith("Đang tải") && !ui.buildModeStatus.textContent.includes("Không tải")) {
        ui.buildModeStatus.textContent = "Nhấn Tải gợi ý để tìm move set cho Partner.";
      }
      return;
    }

    const source = document.createElement("p");
    source.className = "muted moveset-source";
    source.textContent = "Build cộng đồng theo luật game; dùng làm lộ trình tham khảo.";
    ui.moveset.append(source);
    for (const [index, move] of state.partnerBuild.moves.entries()) {
      const row = document.createElement("div");
      row.className = "build-item moveset-item";
      const name = document.createElement("span");
      name.textContent = `${index + 1}. ${move.name}${move.role ? ` · ${move.role}` : ""}`;
      const evo = document.createElement("span");
      evo.className = "build-level";
      evo.textContent = moveData.find((item) => normalize(item.name) === normalize(move.name))?.evoStat || "Move";
      if (move.evolves) evo.title = move.evolves;
      row.append(name, evo);
      ui.moveset.append(row);
    }
    const suggestedBond = getPartnerBuildBondPair();
    if (suggestedBond) {
      const bond = document.createElement("p");
      bond.className = "muted moveset-source";
      bond.textContent = `Bond ưu tiên: ${suggestedBond.names.join(" + ")} · ${suggestedBond.source === "guide" ? "theo hướng dẫn build" : "xếp theo phối hợp và thứ tự move"}`;
      ui.moveset.append(bond);
    }
    if (state.partnerBuild.cardPriority.length) {
      const priority = document.createElement("p");
      priority.className = "muted moveset-source";
      priority.textContent = `Thẻ ưu tiên: ${state.partnerBuild.cardPriority.join(" → ")}`;
      ui.moveset.append(priority);
    }
    if (state.partnerBuild.url) {
      const link = document.createElement("a");
      link.className = "build-source-link";
      link.href = state.partnerBuild.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Mở nguồn build";
      ui.moveset.append(link);
    }
    ui.buildModeStatus.textContent = state.autoBuildFromMoveset
      ? "Đang ưu tiên move và thẻ theo move set này."
      : "Bật tự build để ưu tiên move set này khi chọn thẻ.";
    ui.bondStatus.textContent = state.autoBondFromMoveset
      ? "Đang chờ Bond; dùng cặp được hướng dẫn hoặc cặp phối hợp tốt nhất trong move set."
      : "Bật để tự chọn hai move Bond theo move set Partner.";
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
  }

  function renderTargets() {
    ui.targets.replaceChildren();
    if (!state.targets.length) {
      ui.targets.classList.add("empty");
      ui.targets.textContent = "Chưa chọn skill mục tiêu.";
      return;
    }
    ui.targets.classList.remove("empty");
    for (const [index, target] of state.targets.entries()) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = `${index + 1}. ${target} ×`;
      chip.title = `Ưu tiên #${index + 1}; bấm để bỏ skill mục tiêu`;
      chip.addEventListener("click", () => {
        state.targets = state.targets.filter((item) => normalize(item) !== normalize(target));
        persistState();
        renderTargets();
        refreshRecommendations();
      });
      ui.targets.append(chip);
    }
  }

  function resetRun() {
    clearRunTracker();
    persistState();
    refreshRecommendations();
  }

  function clearRunTracker() {
    if (autoPickTimer) clearTimeout(autoPickTimer);
    autoPickTimer = null;
    pendingAutoPickSignature = "";
    autoPickSignature = "";
    lastTrackedSelectionSignature = "";
    lastTrackedSelectionAt = 0;
    clearBondTracking();
    clearItemTracking();
    state.learnedMoves = [];
    state.fusedGroups = [];
    state.statPicks = [];
    state.heldItem = "";
    state.lastLevel = 0;
    renderBuild();
  }

  function updateLevelUpState() {
    const screen = document.querySelector("#scr-levelup");
    const visible = Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
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
    const visible = Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
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

  function startDodgeMonitor() {
    if (dodgeScanTimer) clearInterval(dodgeScanTimer);
    dodgeScanTimer = setInterval(scanRiftTelegraph, DODGE_SCAN_INTERVAL_MS);
    scanRiftTelegraph();
  }

  function stopDodgeMonitor() {
    if (dodgeScanTimer) clearInterval(dodgeScanTimer);
    if (dodgeMoveTimer) clearTimeout(dodgeMoveTimer);
    dodgeScanTimer = null;
    dodgeMoveTimer = null;
    dodgeThreatMissingAt = 0;
    dodgeThreatHandled = false;
    releaseDodgeKeys();
  }

  function onDodgeVisibilityChange() {
    if (document.hidden) releaseDodgeKeys();
  }

  function onManualMovementKeydown(event) {
    if (!autoDodgeEnabled || !event.isTrusted || !isMovementKey(event.key)) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    dodgeManualPauseUntil = Date.now() + 1200;
    releaseDodgeKeys();
    ui.dodgeStatus.textContent = "Đã nhường điều khiển; sẽ tự né lại sau khi bạn ngừng di chuyển.";
  }

  function onManualMovementKeyup(event) {
    if (!autoDodgeEnabled || !event.isTrusted || !isMovementKey(event.key)) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    dodgeManualPauseUntil = Date.now() + 1200;
  }

  function isMovementKey(key) {
    return ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(String(key || "").toLowerCase());
  }

  function isBlockingRunScreen() {
    return ["#scr-levelup", "#scr-bond", "#scr-item", "#scr-pause", "#scr-over"].some((selector) => {
      const screen = document.querySelector(selector);
      return Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
    });
  }

  function scanRiftTelegraph() {
    if (!autoDodgeEnabled) return;
    if (!document.body.classList.contains("in-run")) {
      autoDodgeEnabled = false;
      ui.autoDodge.checked = false;
      stopDodgeMonitor();
      ui.dodgeStatus.textContent = "Đã tắt khi rời lượt; bật lại khi đang ở Vách Nứt.";
      return;
    }
    if (document.hidden || isBlockingRunScreen()) {
      releaseDodgeKeys();
      ui.dodgeStatus.textContent = document.hidden
        ? "Tạm dừng khi tab game không hiển thị."
        : "Đang chờ màn chơi hoạt động; né tự dừng khi mở menu.";
      return;
    }
    if (Date.now() < dodgeManualPauseUntil) {
      releaseDodgeKeys();
      return;
    }

    const canvas = document.querySelector("#game");
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.width || !canvas.height) {
      ui.dodgeStatus.textContent = "Chưa đọc được vùng chơi để theo dõi cảnh báo.";
      return;
    }

    let imageData;
    try {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("2D canvas unavailable");
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_error) {
      releaseDodgeKeys();
      autoDodgeEnabled = false;
      ui.autoDodge.checked = false;
      stopDodgeMonitor();
      ui.dodgeStatus.textContent = "Canvas game không cho đọc điểm ảnh; tự né đang tạm dừng.";
      return;
    }

    const analysis = analyzePinkWarningLines(imageData);
    if (!analysis || !analysis.focus) {
      if (!dodgeThreatMissingAt) dodgeThreatMissingAt = Date.now();
      if (Date.now() - dodgeThreatMissingAt > 650) dodgeThreatHandled = false;
      releaseDodgeKeys();
      ui.dodgeStatus.textContent = analysis?.pinkPixels > 80
        ? "Có hiệu ứng hồng nhưng chưa nhận diện được dải cảnh báo giao nhau."
        : "Đang chờ dải cảnh báo hồng của boss.";
      return;
    }
    dodgeThreatMissingAt = 0;

    if (!dodgeThreatHandled) {
      const direction = chooseDodgeDirection(analysis.mask, analysis.width, analysis.height, analysis.focus);
      if (!direction || direction.score > 0.62) {
        ui.dodgeStatus.textContent = "Đã thấy dải cảnh báo nhưng chưa có hướng né đủ thoáng; chưa gửi lệnh di chuyển.";
        return;
      }
      dodgeThreatHandled = true;
      pressDodgeDirection(direction);
      ui.dodgeStatus.textContent = "Đã phát hiện dải cảnh báo giao nhau; gửi một nhịp né " + direction.label + ".";
      return;
    }

    ui.dodgeStatus.textContent = "Đang theo dõi dải cảnh báo; đã gửi một nhịp né cho đợt hiện tại.";
  }

  function analyzePinkWarningLines(imageData) {
    const step = Math.max(3, Math.ceil(Math.max(imageData.width, imageData.height) / 320));
    const width = Math.ceil(imageData.width / step);
    const height = Math.ceil(imageData.height / step);
    const mask = new Uint8Array(width * height);
    const points = [];
    const data = imageData.data;
    let pinkPixels = 0;

    for (let gy = 0; gy < height; gy += 1) {
      const y = Math.min(imageData.height - 1, gy * step + Math.floor(step / 2));
      for (let gx = 0; gx < width; gx += 1) {
        const x = Math.min(imageData.width - 1, gx * step + Math.floor(step / 2));
        const offset = (y * imageData.width + x) * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        if (red >= 88 && red - green >= 28 && red - blue >= 10 && green < 176 && blue < 208) {
          const index = gy * width + gx;
          mask[index] = 1;
          points.push({ x: gx, y: gy });
          pinkPixels += 1;
        }
      }
    }

    if (points.length < 90) return { mask, width, height, pinkPixels, focus: null };
    const lines = houghWarningLines(points, width, height);
    if (lines.length < 4) return { mask, width, height, pinkPixels, focus: null };
    const focus = intersectingLineFocus(lines, width, height);
    return { mask, width, height, pinkPixels, focus };
  }

  function houghWarningLines(points, width, height) {
    const angleStep = 3;
    const angleCount = 60;
    const rhoMax = Math.ceil(Math.hypot(width, height));
    const rhoSize = rhoMax * 2 + 1;
    const accumulator = new Uint16Array(angleCount * rhoSize);
    const trig = Array.from({ length: angleCount }, (_value, index) => {
      const radians = index * angleStep * Math.PI / 180;
      return { cosine: Math.cos(radians), sine: Math.sin(radians) };
    });
    const pointStride = Math.max(1, Math.ceil(points.length / 3600));
    let sampledPoints = 0;

    for (let p = 0; p < points.length; p += pointStride) {
      const point = points[p];
      sampledPoints += 1;
      for (let angle = 0; angle < angleCount; angle += 1) {
        const direction = trig[angle];
        const rho = Math.round(point.x * direction.cosine + point.y * direction.sine) + rhoMax;
        accumulator[angle * rhoSize + rho] += 1;
      }
    }

    const minVotes = Math.max(22, Math.round(sampledPoints * 0.025));
    const peaks = [];
    for (let angle = 0; angle < angleCount; angle += 1) {
      for (let rho = 4; rho < rhoSize - 4; rho += 1) {
        const votes = accumulator[angle * rhoSize + rho];
        if (votes < minVotes) continue;
        let isPeak = true;
        for (let da = -1; da <= 1 && isPeak; da += 1) {
          for (let dr = -3; dr <= 3; dr += 1) {
            if (!da && !dr) continue;
            const neighborAngle = angle + da;
            if (neighborAngle < 0 || neighborAngle >= angleCount) continue;
            if (accumulator[neighborAngle * rhoSize + rho + dr] > votes) {
              isPeak = false;
              break;
            }
          }
        }
        if (isPeak) peaks.push({ angle: angle * angleStep, rho: rho - rhoMax, votes });
      }
    }

    peaks.sort((a, b) => b.votes - a.votes);
    const selected = [];
    for (const peak of peaks) {
      const duplicate = selected.some((line) => Math.abs(line.angle - peak.angle) <= 6 && Math.abs(line.rho - peak.rho) <= 5);
      if (!duplicate) selected.push(peak);
      if (selected.length >= 18) break;
    }
    return selected;
  }

  function intersectingLineFocus(lines, width, height) {
    const intersections = [];
    for (let i = 0; i < lines.length; i += 1) {
      const a = lines[i];
      const angleA = a.angle * Math.PI / 180;
      const cosA = Math.cos(angleA);
      const sinA = Math.sin(angleA);
      for (let j = i + 1; j < lines.length; j += 1) {
        const b = lines[j];
        const angleB = b.angle * Math.PI / 180;
        const cosB = Math.cos(angleB);
        const sinB = Math.sin(angleB);
        const determinant = cosA * sinB - cosB * sinA;
        if (Math.abs(determinant) < 0.16) continue;
        const x = (a.rho * sinB - b.rho * sinA) / determinant;
        const y = (cosA * b.rho - cosB * a.rho) / determinant;
        if (x < -width * 0.05 || x > width * 1.05 || y < -height * 0.05 || y > height * 1.05) continue;
        intersections.push({ x, y, weight: a.votes + b.votes });
      }
    }
    if (intersections.length < 5) return null;

    let bestCluster = [];
    let bestWeight = 0;
    const radius = Math.max(6, Math.min(width, height) * 0.075);
    for (const seed of intersections) {
      const cluster = intersections.filter((point) => Math.hypot(point.x - seed.x, point.y - seed.y) <= radius);
      const weight = cluster.reduce((sum, point) => sum + point.weight, 0);
      if (cluster.length > bestCluster.length || (cluster.length === bestCluster.length && weight > bestWeight)) {
        bestCluster = cluster;
        bestWeight = weight;
      }
    }
    if (bestCluster.length < 4) return null;
    const totalWeight = bestCluster.reduce((sum, point) => sum + point.weight, 0);
    return {
      x: bestCluster.reduce((sum, point) => sum + point.x * point.weight, 0) / totalWeight,
      y: bestCluster.reduce((sum, point) => sum + point.y * point.weight, 0) / totalWeight
    };
  }

  function chooseDodgeDirection(mask, width, height, focus) {
    const directions = [
      { x: 0, y: -1, label: "lên", keys: ["w"] },
      { x: 1, y: -1, label: "lên-phải", keys: ["w", "d"] },
      { x: 1, y: 0, label: "phải", keys: ["d"] },
      { x: 1, y: 1, label: "xuống-phải", keys: ["s", "d"] },
      { x: 0, y: 1, label: "xuống", keys: ["s"] },
      { x: -1, y: 1, label: "xuống-trái", keys: ["s", "a"] },
      { x: -1, y: 0, label: "trái", keys: ["a"] },
      { x: -1, y: -1, label: "lên-trái", keys: ["w", "a"] }
    ];
    const searchDistance = Math.max(18, Math.min(width, height) * 0.27);
    const corridor = Math.max(2, Math.round(Math.min(width, height) * 0.025));
    let best = null;

    for (const direction of directions) {
      const length = Math.hypot(direction.x, direction.y);
      const dx = direction.x / length;
      const dy = direction.y / length;
      const perpendicularX = -dy;
      const perpendicularY = dx;
      let danger = 0;
      let samples = 0;
      let outside = 0;
      for (let distance = 5; distance <= searchDistance; distance += 2) {
        for (let lateral = -corridor; lateral <= corridor; lateral += 2) {
          const x = Math.round(focus.x + dx * distance + perpendicularX * lateral);
          const y = Math.round(focus.y + dy * distance + perpendicularY * lateral);
          if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
            outside += 1;
            continue;
          }
          samples += 1;
          if (mask[y * width + x]) danger += 1;
        }
      }
      if (!samples) continue;
      const score = danger / samples + outside / (samples + outside) * 0.75;
      if (!best || score < best.score) best = { ...direction, score };
    }
    return best;
  }

  function pressDodgeDirection(direction) {
    releaseDodgeKeys();
    dodgeHeldKeys = [...direction.keys];
    for (const key of dodgeHeldKeys) dispatchMovementKey("keydown", key);
    if (dodgeMoveTimer) clearTimeout(dodgeMoveTimer);
    dodgeMoveTimer = setTimeout(releaseDodgeKeys, DODGE_MOVE_PULSE_MS);
  }

  function dispatchMovementKey(type, key) {
    const codeByKey = { w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD" };
    const keyCodeByKey = { w: 87, a: 65, s: 83, d: 68 };
    document.dispatchEvent(new KeyboardEvent(type, {
      key,
      code: codeByKey[key],
      keyCode: keyCodeByKey[key],
      which: keyCodeByKey[key],
      bubbles: true,
      cancelable: true,
      composed: true
    }));
  }

  function releaseDodgeKeys() {
    if (dodgeMoveTimer) clearTimeout(dodgeMoveTimer);
    dodgeMoveTimer = null;
    for (const key of dodgeHeldKeys) dispatchMovementKey("keyup", key);
    dodgeHeldKeys = [];
  }

  function cardNodes() {
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
    return { element: card, text: (card.innerText || card.textContent || "").trim().replace(/\s+/g, " "), normalizedText, move, evolution, stat };
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

  function activeMovePriorityNames() {
    const names = [];
    if (state.autoBuildFromMoveset && hasPartnerBuildForCurrentPokemon()) {
      names.push(...state.partnerBuild.moves.map((move) => move.name));
    }
    names.push(...state.targets);
    return [...new Map(names.map((name) => [normalize(name), name])).values()];
  }

  function activeCardPriorityNames() {
    return state.autoBuildFromMoveset && hasPartnerBuildForCurrentPokemon()
      ? state.partnerBuild.cardPriority
      : [];
  }

  function upgradeCategory(candidate) {
    if (candidate.stat) {
      const stat = normalize(candidate.stat);
      if (stat === "power") return "damage";
      if (stat === "reflexes") return "cooldown";
      if (stat === "vigor" || stat === "armor" || stat === "synthesis") return "survival";
      if (stat === "sprint") return "mobility";
      if (stat === "magnet") return "utility";
    }
    const text = candidate.normalizedText;
    if (/heal|healing|regen|shield|armor|defen|health|\bhp\b|vigor|sitrus|leftovers/.test(text)) return "survival";
    if (/cooldown|reflex/.test(text)) return "cooldown";
    if (/projectile|projectiles|pierce|shots|shot count/.test(text)) return "projectile";
    if (/speed|sprint|movement|dash/.test(text)) return "mobility";
    if (/experience|pickup radius|magnet|collect/.test(text)) return "utility";
    if (/range|area|radius|duration/.test(text)) return "area";
    if (/critical|crit|damage|attack|power|physical|special|offense/.test(text)) return "damage";
    return "unknown";
  }

  function strategyUpgradeScore(category) {
    const weights = {
      balanced: { damage: 8, cooldown: 7, projectile: 7, area: 6, survival: 6, mobility: 5, utility: 4, unknown: 1 },
      evolve: { damage: 8, cooldown: 7, projectile: 6, area: 5, survival: 6, mobility: 4, utility: 3, unknown: 1 },
      physical: { damage: 9, projectile: 8, cooldown: 7, area: 6, survival: 5, mobility: 5, utility: 3, unknown: 1 },
      special: { damage: 9, projectile: 7, cooldown: 8, area: 6, survival: 5, mobility: 5, utility: 3, unknown: 1 },
      survival: { damage: 6, projectile: 5, cooldown: 7, area: 5, survival: 10, mobility: 8, utility: 6, unknown: 1 }
    };
    return weights[state.strategy]?.[category] ?? weights.balanced.unknown;
  }

  function scoreCandidate(candidate) {
    let score = 0;
    const reasons = [];
    const pokemon = currentPokemon();
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
      if (state.autoBuildFromMoveset && hasPartnerBuildForCurrentPokemon()) {
        const moveSetIndex = state.partnerBuild.moves.findIndex((item) => normalize(item.name) === normalize(move.name));
        if (moveSetIndex >= 0) {
          score += Math.max(20, 36 - moveSetIndex * 4);
          reasons.push(`thuộc move set Partner, ưu tiên #${moveSetIndex + 1}`);
        } else {
          score -= 4;
          reasons.push("ngoài move set Partner đang theo");
        }
      }
      const monoTypeMatch = pokemon?.types.length === 1 && normalize(pokemon.types[0]) === normalize(move.type);
      if (monoTypeMatch) {
        score += 15;
        reasons.push(`đúng hệ đơn ${move.type} (+20% sát thương trong game)`);
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
      const cardPriority = activeCardPriorityNames();
      const cardPriorityIndex = cardPriority.findIndex((name) => normalize(name) === normalize(candidate.stat));
      if (cardPriorityIndex >= 0) {
        score += Math.max(18, 30 - cardPriorityIndex * 3);
        reasons.push(`thẻ ưu tiên #${cardPriorityIndex + 1} trong lộ trình build`);
      } else {
        score += strategyUpgradeScore(upgradeCategory(candidate));
        reasons.push(`thuộc tính theo hướng ${STRATEGIES[strategy]}`);
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
      const category = upgradeCategory(candidate);
      const strategyScore = strategyUpgradeScore(category);
      score += strategyScore;
      reasons.push(category === "unknown"
        ? `chưa có điểm dữ liệu; xếp theo hướng ${STRATEGIES[strategy]}`
        : `nâng cấp ${category === "survival" ? "sinh tồn" : category === "cooldown" ? "giảm hồi chiêu" : category === "projectile" ? "đạn/độ xuyên" : category === "mobility" ? "di chuyển" : category === "utility" ? "thu thập" : category === "area" ? "vùng tác dụng" : "sát thương"} hợp hướng ${STRATEGIES[strategy]}`);
    }

    if (!reasons.length) {
      score += strategyUpgradeScore("unknown");
      reasons.push(`chưa khớp dữ liệu move; xếp theo hướng ${STRATEGIES[strategy]}`);
    }
    return { ...candidate, score, reasons };
  }

  function refreshRecommendations() {
    const candidates = cardNodes().map(candidateFromCard).filter((candidate) => candidate.text);
    cachedCandidates = candidates.map(scoreCandidate).sort((a, b) => b.score - a.score);
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

  function cardSelectionSignature() {
    const level = document.querySelector("#lvl-num")?.textContent?.trim() || "?";
    const text = cardNodes().map((card) => normalize(card.innerText || card.textContent || "")).join("||");
    return `${level}:${text}`;
  }

  function scoredCandidateSignature(candidates) {
    const scores = candidates.map((candidate) => `${normalize(candidate.text)}=${candidate.score}:${normalize(candidate.reasons.join(" "))}`).join("||");
    const preferences = `${state.strategy}:${state.autoBuildFromMoveset}:${activeMovePriorityNames().map(normalize).join(",")}:${activeCardPriorityNames().map(normalize).join(",")}`;
    return `${cardSelectionSignature()}::${scores}::${preferences}`;
  }

  function chooseAutoCandidate(candidates) {
    if (!candidates.length) return { candidate: null, gap: Infinity, rule: "none", priorityIndex: -1 };
    const top = candidates[0];
    const runnerUp = candidates[1];
    const gap = runnerUp ? Math.max(0, top.score - runnerUp.score) : Infinity;
    if (gap <= AUTO_PICK_NEAR_TIE_GAP) {
      const priorities = activeMovePriorityNames();
      for (const [priorityIndex, name] of priorities.entries()) {
        const match = candidates.find((candidate) => candidate.move
          && normalize(candidate.move.name) === normalize(name)
          && top.score - candidate.score <= AUTO_PICK_NEAR_TIE_GAP);
        if (match) return { candidate: match, gap, rule: "move-priority", priorityIndex };
      }
      return { candidate: top, gap, rule: "build-direction", priorityIndex: -1 };
    }
    return { candidate: top, gap, rule: "score", priorityIndex: -1 };
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

    const decision = chooseAutoCandidate(candidates);
    const best = decision.candidate;
    const autoEligible = Boolean(best && (decision.gap <= AUTO_PICK_NEAR_TIE_GAP || best.score > AUTO_PICK_MIN_SCORE));
    if (!autoEligible) {
      ui.autoStatus.textContent = `Chênh ${Math.round(decision.gap)} điểm và thẻ đầu chưa vượt 6 điểm; đang chờ lựa chọn rõ hơn.`;
      return;
    }

    const ruleText = decision.rule === "move-priority"
      ? `theo ưu tiên move #${decision.priorityIndex + 1}`
      : decision.rule === "build-direction" ? `theo hướng ${STRATEGIES[state.strategy]}` : "theo điểm cao nhất";
    ui.autoStatus.textContent = `Sẽ tự chọn ${best.move?.name || best.text.slice(0, 32)} ${ruleText} sau khi thẻ ổn định.`;
    pendingAutoPickSignature = planSignature;
    autoPickTimer = setTimeout(() => {
      autoPickTimer = null;
      pendingAutoPickSignature = "";
      const currentScreen = document.querySelector("#scr-levelup");
      const currentCandidates = cardNodes().map(candidateFromCard).filter((candidate) => candidate.text).map(scoreCandidate).sort((a, b) => b.score - a.score);
      const currentDecision = chooseAutoCandidate(currentCandidates);
      if (!state.autoPick || !isLevelUpVisible || !currentScreen || currentScreen.classList.contains("hidden") || getComputedStyle(currentScreen).display === "none" || scoredCandidateSignature(currentCandidates) !== planSignature || normalize(currentDecision.candidate?.text) !== normalize(best.text) || !best.element.isConnected) return;
      best.element.click();
      const stillVisible = !currentScreen.classList.contains("hidden") && getComputedStyle(currentScreen).display !== "none";
      const accepted = !stillVisible || cardsRoot.classList.contains("done");
      if (!accepted) {
        autoPickSignature = "";
        ui.autoStatus.textContent = "Game chưa nhận click nên skill chưa được ghi nhận; bạn có thể chọn thẻ thủ công.";
        return;
      }
      autoPickSignature = cardSignature;
      trackGameSelection(best);
      ui.autoStatus.textContent = `Đã bấm và ghi nhận: ${best.move?.name || best.text.slice(0, 32)}.`;
      ui.status.textContent = `Game đã nhận thẻ phù hợp nhất cho ${state.pokemon || "Pokémon hiện tại"}.`;
    }, AUTO_PICK_DELAY_MS);
  }

  function fusionPairScore(moveA, moveB) {
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
    const pokemon = currentPokemon();
    if (pokemon?.types.length === 1 && normalize(pokemon.types[0]) === normalize(moveA.type) && normalize(moveA.type) === normalize(moveB.type)) {
      score += 6;
      reasons.push(`cùng hệ đơn ${moveA.type}`);
    }
    if (profileA.isBuff && profileB.isBuff) {
      score -= 8;
      reasons.push("cặp này thiếu đòn gây sát thương trực tiếp");
    }
    return { score, reasons: reasons.slice(0, 3) };
  }

  function getPartnerBuildBondPair() {
    if (!hasPartnerBuildForCurrentPokemon()) return null;
    const explicit = (state.partnerBuild.bondGroups || []).find((group) => group.length >= 2);
    if (explicit) return { names: explicit.slice(0, 2), source: "guide" };

    const moves = state.partnerBuild.moves
      .map((item, index) => ({ move: getMoveData(item.name), index }))
      .filter((item) => item.move);
    let best = null;
    for (let i = 0; i < moves.length; i += 1) {
      for (let j = i + 1; j < moves.length; j += 1) {
        const pair = [moves[i], moves[j]];
        const synergy = fusionPairScore(pair[0].move, pair[1].move);
        const orderBonus = (MAX_MOVE_SLOTS - pair[0].index + MAX_MOVE_SLOTS - pair[1].index) * 3;
        const score = synergy.score + orderBonus;
        if (!best || score > best.score) {
          best = { names: pair.map((item) => item.move.name), source: "moveset", score, reasons: synergy.reasons };
        }
      }
    }
    return best;
  }

  function bondCardNodes() {
    if (!bondCardsRoot) return [];
    const cardClassNodes = Array.from(bondCardsRoot.querySelectorAll(".card"));
    if (cardClassNodes.length) return cardClassNodes;
    const buttons = Array.from(bondCardsRoot.querySelectorAll('button, [role="button"]'));
    if (buttons.length) return buttons;
    return Array.from(bondCardsRoot.children).filter((node) => node instanceof HTMLElement);
  }

  function bondCandidates() {
    return bondCardNodes().map(candidateFromCard).filter((candidate) => candidate.move);
  }

  function bondPhase() {
    const prompt = normalize(document.querySelector("#bond-sub")?.textContent || "");
    if (/\b(first|1st)\b/.test(prompt)) return "first";
    if (/\b(second|2nd|another)\b/.test(prompt)) return "second";
    return "unknown";
  }

  function bondScreenVisible() {
    const screen = document.querySelector("#scr-bond");
    return Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
  }

  function bondPriority(name) {
    const index = state.partnerBuild?.moves.findIndex((move) => normalize(move.name) === normalize(name)) ?? -1;
    return index < 0 ? 0 : Math.max(1, MAX_MOVE_SLOTS - index) * 3;
  }

  function chooseBondPlan(candidates) {
    const available = new Map(candidates.map((candidate) => [normalize(candidate.move.name), candidate.move]));
    for (const group of state.partnerBuild?.bondGroups || []) {
      const pair = group.slice(0, 2).map((name) => available.get(normalize(name)) || null);
      if (pair.length === 2 && pair.every(Boolean)) return { names: pair.map((move) => move.name), source: "guide" };
    }

    const suggested = getPartnerBuildBondPair();
    if (suggested && suggested.names.every((name) => available.has(normalize(name)))) return suggested;

    let best = null;
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const first = candidates[i].move;
        const second = candidates[j].move;
        const synergy = fusionPairScore(first, second);
        const score = synergy.score + bondPriority(first.name) + bondPriority(second.name);
        if (!best || score > best.score) {
          const firstPriority = bondPriority(first.name);
          const secondPriority = bondPriority(second.name);
          const names = firstPriority >= secondPriority ? [first.name, second.name] : [second.name, first.name];
          best = { names, source: "moveset", score, reasons: synergy.reasons };
        }
      }
    }
    return best;
  }

  function chooseBondPartner(firstName, candidates) {
    for (const group of state.partnerBuild?.bondGroups || []) {
      if (group.some((name) => normalize(name) === normalize(firstName))) {
        const name = group.find((item) => normalize(item) !== normalize(firstName)
          && candidates.some((candidate) => normalize(candidate.move.name) === normalize(item)));
        if (name) return candidates.find((candidate) => normalize(candidate.move.name) === normalize(name));
      }
    }
    const suggested = getPartnerBuildBondPair();
    if (suggested?.names.some((name) => normalize(name) === normalize(firstName))) {
      const preferred = suggested.names.find((name) => normalize(name) !== normalize(firstName));
      const match = candidates.find((candidate) => normalize(candidate.move.name) === normalize(preferred));
      if (match) return match;
    }

    const first = getMoveData(firstName);
    if (!first) return null;
    return candidates
      .filter((candidate) => normalize(candidate.move.name) !== normalize(firstName))
      .map((candidate) => ({
        candidate,
        score: fusionPairScore(first, candidate.move).score + bondPriority(candidate.move.name)
      }))
      .sort((a, b) => b.score - a.score)[0]?.candidate || null;
  }

  function bondSelectionSignature(phase, candidates) {
    return `${phase}|${candidates.map((candidate) => normalize(candidate.move.name)).join(",")}`;
  }

  function updateBondState() {
    const visible = bondScreenVisible();
    if (!visible) {
      if (isBondVisible) {
        if (bondPendingFirstMove && bondPendingSecondMove) {
          markMovesFused([bondPendingFirstMove, bondPendingSecondMove]);
          ui.bondStatus.textContent = `Đã ghi nhận Bond: ${bondPendingFirstMove} + ${bondPendingSecondMove}.`;
        } else if (bondPendingFirstMove) {
          ui.bondStatus.textContent = `Bond đóng trước khi chọn move thứ hai; chưa ghi nhận ${bondPendingFirstMove}.`;
        }
        clearBondTracking();
        isBondVisible = false;
        if (!isLevelUpVisible) setPanelOpen(false);
      }
      return;
    }

    if (!isBondVisible) {
      isBondVisible = true;
      bondManualOverride = false;
      bondAttemptSignature = "";
      setPanelOpen(true);
    }
    const phase = bondPhase();
    const candidates = bondCandidates();
    if (phase === "second" && bondWatchdogTimer) {
      clearTimeout(bondWatchdogTimer);
      bondWatchdogTimer = null;
    }
    if (bondPendingSecondMove || bondManualOverride) return;
    if (!state.autoBondFromMoveset || !hasPartnerBuildForCurrentPokemon()) {
      if (phase === "unknown") ui.bondStatus.textContent = "Đã nhận màn Bond; chưa xác định được bước chọn từ nội dung game.";
      else if (!state.autoBondFromMoveset) ui.bondStatus.textContent = "Đã nhận màn Bond; tự chọn đang tắt.";
      return;
    }
    if (phase === "unknown" || !candidates.length) {
      ui.bondStatus.textContent = "Đã nhận màn Bond; đang chờ danh sách move ổn định.";
      return;
    }

    if (phase === "first") {
      if (bondPendingFirstMove) return;
      const plan = chooseBondPlan(candidates);
      const firstName = plan?.names[0];
      const candidate = candidates.find((item) => normalize(item.move.name) === normalize(firstName));
      if (!candidate) {
        ui.bondStatus.textContent = "Không đủ hai move khớp move set để tự chọn Bond.";
        return;
      }
      const signature = bondSelectionSignature(phase, candidates);
      queueBondChoice(candidate, phase, signature, plan?.source === "guide"
        ? `cặp trong hướng dẫn build: ${plan.names.join(" + ")}`
        : `move set Partner: ${plan.names.join(" + ")}`);
      return;
    }

    if (!bondPendingFirstMove) {
      const selected = bondCardNodes().find((node) => node.matches('[aria-selected="true"], [aria-pressed="true"], .selected, .is-selected, .chosen'));
      const inferred = selected ? candidateFromCard(selected).move?.name : "";
      if (inferred) bondPendingFirstMove = inferred;
    }
    if (!bondPendingFirstMove) {
      ui.bondStatus.textContent = "Chưa nhận diện move thứ nhất; sẽ không tự chọn ngẫu nhiên move thứ hai.";
      return;
    }
    const candidate = chooseBondPartner(bondPendingFirstMove, candidates);
    if (!candidate) {
      ui.bondStatus.textContent = `Không tìm thấy move ghép phù hợp với ${bondPendingFirstMove}.`;
      return;
    }
    const signature = bondSelectionSignature(phase, candidates);
    queueBondChoice(candidate, phase, signature, `ghép với ${bondPendingFirstMove}`);
  }

  function queueBondChoice(candidate, phase, signature, reason) {
    if (bondAutoTimer || bondAttemptSignature === signature) return;
    bondAttemptSignature = signature;
    ui.bondStatus.textContent = `Sẽ tự chọn ${candidate.move.name} (${reason})…`;
    bondAutoTimer = setTimeout(() => {
      bondAutoTimer = null;
      const currentPhase = bondPhase();
      const currentCandidates = bondCandidates();
      const current = currentCandidates.find((item) => normalize(item.move.name) === normalize(candidate.move.name));
      if (!state.autoBondFromMoveset || !bondScreenVisible() || currentPhase !== phase || !current?.element.isConnected || bondManualOverride) {
        bondAttemptSignature = "";
        updateBondState();
        return;
      }
      if (phase === "first") {
        bondPendingFirstMove = current.move.name;
        bondPendingSecondMove = "";
      } else {
        bondPendingSecondMove = current.move.name;
      }
      bondPendingStartedAt = Date.now();
      current.element.click();
      ui.bondStatus.textContent = `Đã bấm ${current.move.name}; đang chờ game xác nhận bước Bond.`;
      if (bondWatchdogTimer) clearTimeout(bondWatchdogTimer);
      bondWatchdogTimer = setTimeout(() => {
        bondWatchdogTimer = null;
        if (!bondScreenVisible()) return;
        const stillSamePhase = bondPhase() === phase;
        if (stillSamePhase && phase === "first" && normalize(bondPendingFirstMove) === normalize(current.move.name)) {
          bondPendingFirstMove = "";
          ui.bondStatus.textContent = `Game chưa chuyển sang bước chọn thứ hai sau khi bấm ${current.move.name}; hãy chọn thủ công.`;
        } else if (stillSamePhase && phase === "second" && normalize(bondPendingSecondMove) === normalize(current.move.name)) {
          bondPendingSecondMove = "";
          ui.bondStatus.textContent = `Game chưa xác nhận move ${current.move.name}; hãy chọn thủ công.`;
        }
      }, 1800);
    }, AUTO_BOND_DELAY_MS);
  }

  function recordManualBondChoice(candidate) {
    if (!candidate?.move) return;
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    bondAutoTimer = null;
    bondAttemptSignature = "";
    bondManualOverride = true;
    if (bondPhase() === "first" || !bondPendingFirstMove) {
      bondPendingFirstMove = candidate.move.name;
      bondPendingSecondMove = "";
      ui.bondStatus.textContent = `Đã nhận move thứ nhất: ${candidate.move.name}.`;
    } else {
      bondPendingSecondMove = candidate.move.name;
      ui.bondStatus.textContent = `Đã nhận cặp ${bondPendingFirstMove} + ${candidate.move.name}; chờ game xác nhận.`;
    }
  }

  function onGameBondCardClick(event) {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest("#bond-cards .card") || target?.closest('#bond-cards button, #bond-cards [role="button"]') || target?.closest("#bond-cards > *");
    if (card) recordManualBondChoice(candidateFromCard(card));
  }

  function clearBondTracking() {
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    if (bondWatchdogTimer) clearTimeout(bondWatchdogTimer);
    bondAutoTimer = null;
    bondWatchdogTimer = null;
    bondAttemptSignature = "";
    bondPendingFirstMove = "";
    bondPendingSecondMove = "";
    bondPendingStartedAt = 0;
    bondManualOverride = false;
  }

  function itemCardNodes() {
    if (!itemCardsRoot) return [];
    const cardClassNodes = Array.from(itemCardsRoot.querySelectorAll(".card"));
    if (cardClassNodes.length) return cardClassNodes;
    const buttons = Array.from(itemCardsRoot.querySelectorAll('button, [role="button"]'));
    if (buttons.length) return buttons;
    return Array.from(itemCardsRoot.children).filter((node) => node instanceof HTMLElement);
  }

  function itemDefinitionFromText(text) {
    const normalizedText = normalize(text);
    return ITEM_DEFINITIONS.find((item) => item.aliases.some((alias) => normalizedText.includes(normalize(alias)))
      || item.effects.some((pattern) => pattern.test(normalizedText))) || null;
  }

  function itemCandidateFromCard(card) {
    const parts = [card.innerText || card.textContent || ""];
    const attributes = [];
    for (const element of [card, ...card.querySelectorAll("[data-id], [data-item], [title], [aria-label]")]) {
      for (const attribute of ["data-id", "data-item", "title", "aria-label"]) {
        const value = element.getAttribute?.(attribute);
        if (value) attributes.push(value);
      }
    }
    const fullText = `${parts.join(" ")} ${attributes.join(" ")}`;
    const normalizedText = normalize(fullText);
    const item = itemDefinitionFromText(fullText);
    const action = /\b(keep|mantener|conservar)\b/.test(normalizedText)
      ? "keep"
      : /\b(switch to|replace|cambiar a|sustituir por)\b/.test(normalizedText) ? "switch" : "choose";
    return {
      element: card,
      text: (card.innerText || card.textContent || "").trim().replace(/\s+/g, " "),
      normalizedText,
      item,
      action
    };
  }

  function itemCandidates() {
    return itemCardNodes().map(itemCandidateFromCard).filter((candidate) => candidate.text || candidate.normalizedText);
  }

  function itemBuildFacts() {
    const entries = [];
    const appendMove = (name, level = 1) => {
      const move = getMoveData(name);
      if (!move || entries.some((entry) => normalize(entry.move.name) === normalize(move.name))) return;
      entries.push({ move, level });
    };
    for (const learned of state.learnedMoves) appendMove(learned.name, Number(learned.level) || 1);
    if (!entries.length || (state.autoBuildFromMoveset && hasPartnerBuildForCurrentPokemon())) {
      for (const planned of state.partnerBuild?.moves || []) appendMove(planned.name, 1);
    }
    const profiles = entries.map(({ move, level }) => ({
      move,
      level,
      profile: moveProfile(move),
      rapid: /several times|multiple times|many times|repeatedly|rapidly|spin in place|hits everything/.test(normalize(move.description))
    }));
    const attacks = profiles.filter((entry) => !entry.profile.isBuff && !entry.profile.control);
    return {
      source: state.learnedMoves.length ? "skill đã học" : hasPartnerBuildForCurrentPokemon() ? "move set Partner" : "hướng build",
      moves: profiles,
      attacks,
      areaAttacks: attacks.filter((entry) => entry.profile.area).length,
      rapidAttacks: attacks.filter((entry) => entry.rapid).length,
      hasSustain: profiles.some((entry) => entry.profile.sustain),
      topLevel: Math.max(0, ...profiles.map((entry) => entry.level)),
      armorPicks: state.statPicks.filter((item) => ["armor", "vigor", "synthesis"].includes(normalize(item))).length,
      sprintPicks: state.statPicks.filter((item) => normalize(item) === "sprint").length
    };
  }

  function scoreItemCandidate(candidate, facts = itemBuildFacts()) {
    const item = candidate.item;
    if (!item) return { ...candidate, score: null, reasons: [], recognized: false };
    const score = { value: 0, reasons: [] };
    const add = (value, reason) => {
      score.value += value;
      if (reason) score.reasons.push(reason);
    };
    const attackCount = facts.attacks.length;
    const strategyIsSurvival = state.strategy === "survival";
    switch (item.id) {
      case "quick-claw":
        add(15 + Math.min(6, attackCount * 2), "giảm hồi chiêu cho toàn bộ move đang dùng");
        if (facts.rapidAttacks) add(Math.min(4, facts.rapidAttacks * 2), "hợp build có đòn đánh lặp/đánh nhiều lần");
        break;
      case "lucky-egg":
        add(12, "tăng EXP để lên cấp và hoàn thiện build sớm hơn");
        if (state.lastLevel < 12) add(5, "run còn ở giai đoạn đầu");
        else if (state.lastLevel > 30) add(-3, "run đã ở giai đoạn muộn");
        break;
      case "shell-bell":
        add(7 + Math.min(10, attackCount * 2), "hồi phục dựa trên sát thương gây ra");
        if (facts.rapidAttacks) add(Math.min(6, facts.rapidAttacks * 3), "hợp move đánh nhiều lần");
        if (facts.hasSustain) add(2, "cộng thêm khả năng trụ lâu cho build có hồi phục");
        break;
      case "choice-band":
        add(11, "tăng sát thương mạnh cho build tập trung tấn công");
        if (attackCount <= 1) add(12, "move set có một đòn chủ lực, ít cần đổi move");
        else if (attackCount === 2) add(4, "build có ít đòn tấn công để luân phiên");
        else add(-8, "build nhiều đòn tấn công sẽ bị hạn chế đổi move");
        if (facts.topLevel >= 3) add(3, "đòn chủ lực đã được nâng cấp");
        break;
      case "life-orb":
        add(10 + Math.min(8, attackCount * 2), "tăng sát thương cho các move gây damage");
        if (facts.rapidAttacks) add(Math.min(4, facts.rapidAttacks * 2), "hợp build có đòn đánh liên tục");
        if (strategyIsSurvival) add(-6, "đổi một phần khả năng trụ lâu lấy sát thương");
        if (facts.hasSustain) add(4, "build hiện tại có hồi phục để bù hao HP");
        break;
      case "leftovers":
        add(11, "hồi HP liên tục trong cả lượt");
        if (strategyIsSurvival) add(7, "khớp hướng build Sinh tồn");
        if (!facts.hasSustain) add(3, "bổ sung hồi phục cho build chưa có sustain");
        break;
      case "assault-vest":
        add(11, "giảm damage nhận vào ổn định");
        if (strategyIsSurvival) add(8, "khớp hướng build Sinh tồn");
        add(Math.min(4, facts.armorPicks * 2), "ăn khớp các chỉ số chống chịu đã chọn");
        break;
      case "focus-sash":
        add(9, "chống một đòn kết liễu theo chu kỳ");
        if (strategyIsSurvival) add(7, "khớp hướng build Sinh tồn");
        break;
      case "rocky-helmet":
        add(7, "phản sát thương khi đối thủ đánh cận chiến");
        if (strategyIsSurvival) add(6, "hợp lối chơi chịu đòn và áp sát");
        add(Math.min(6, facts.areaAttacks * 2), "move diện rộng hỗ trợ giữ vị trí gần nhiều đối thủ");
        break;
      case "choice-scarf":
        add(9, "tăng tốc độ để né đám đông và đổi vị trí");
        add(Math.min(4, facts.sprintPicks * 2), "ăn khớp chỉ số Sprint đã chọn");
        if (strategyIsSurvival) add(2, "tăng cơ động cho hướng Sinh tồn");
        break;
      case "amulet-coin":
        add(4, "tăng PokéCoins nhận được khi kết thúc lượt");
        if (state.lastLevel >= 20) add(4, "run đã tiến sâu nên phần thưởng cuối lượt có thể cao hơn");
        break;
      default:
        return { ...candidate, score: null, reasons: [], recognized: false };
    }
    if (candidate.action === "keep" && state.heldItem && normalize(state.heldItem) === normalize(item.name)) {
      add(1, "giữ item hiện tại, không mất hiệu ứng đang có");
    }
    return { ...candidate, score: score.value, reasons: score.reasons, recognized: true, itemName: item.name, buildSource: facts.source };
  }

  function itemCandidateSignature(candidates) {
    return candidates.map((candidate) => `${candidate.item?.id || "unknown"}:${candidate.action}:${candidate.normalizedText}`).join("||");
  }

  function renderItemRecommendations(ranked) {
    ui.itemRecommendations.replaceChildren();
    if (!ranked.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = isItemVisible ? "Đang chờ nội dung item để xếp hạng." : state.heldItem ? `Item hiện tại: ${state.heldItem}.` : "Khi item xuất hiện, extension sẽ xếp hạng theo Partner và move set.";
      ui.itemRecommendations.append(empty);
      ui.itemLabel.textContent = state.heldItem || (isItemVisible ? "đang đọc" : "chờ item");
      return;
    }
    const recognized = ranked.filter((candidate) => candidate.recognized);
    ui.itemLabel.textContent = isItemVisible ? "đang chọn" : state.heldItem || "gợi ý";
    for (const [index, candidate] of recognized.slice(0, 2).entries()) {
      const row = document.createElement("div");
      row.className = `recommendation ${index === 0 ? "best" : ""}`;
      const title = document.createElement("div");
      title.className = "recommendation-head";
      const name = document.createElement("strong");
      name.textContent = `${candidate.action === "keep" ? "Giữ" : candidate.action === "switch" ? "Đổi sang" : "Chọn"} ${candidate.itemName}`;
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = `${candidate.score}đ`;
      title.append(name, score);
      const reason = document.createElement("p");
      reason.textContent = candidate.reasons.slice(0, 3).join(" · ");
      row.append(title, reason);
      ui.itemRecommendations.append(row);
    }
    if (!recognized.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Chưa nhận diện được các item trong lựa chọn hiện tại.";
      ui.itemRecommendations.append(empty);
    }
  }

  function updateItemState() {
    const visible = itemScreenVisible();
    if (!visible) {
      if (isItemVisible) {
        if (pendingItemName) {
          state.heldItem = pendingItemName;
          persistState();
          ui.itemStatus.textContent = `Đã ghi nhận item trong lượt: ${state.heldItem}.`;
        }
        clearItemTracking();
        isItemVisible = false;
        renderItemRecommendations([]);
        if (!isLevelUpVisible && !isBondVisible) setPanelOpen(false);
      }
      return;
    }
    if (!isItemVisible) {
      isItemVisible = true;
      itemManualOverride = false;
      itemAttemptSignature = "";
      setPanelOpen(true);
    }
    const candidates = itemCandidates();
    const facts = itemBuildFacts();
    const ranked = candidates.map((candidate) => scoreItemCandidate(candidate, facts)).sort((a, b) => {
      if (a.recognized !== b.recognized) return a.recognized ? -1 : 1;
      return (b.score ?? -Infinity) - (a.score ?? -Infinity);
    });
    renderItemRecommendations(ranked);
    if (pendingItemName || itemManualOverride) return;
    if (!state.autoPickItems) {
      ui.itemStatus.textContent = "Tự chọn item đang tắt; extension vẫn xếp hạng để bạn chọn.";
      return;
    }
    if (candidates.length < 2) {
      ui.itemStatus.textContent = "Đang chờ đủ lựa chọn item để so sánh.";
      return;
    }
    if (ranked.some((candidate) => !candidate.recognized)) {
      ui.itemStatus.textContent = "Có item chưa nhận diện; extension tạm dừng tự chọn để tránh bấm nhầm.";
      return;
    }
    const best = ranked[0];
    if (!best?.item || !best.element?.isConnected) {
      ui.itemStatus.textContent = "Chưa đọc được item hợp lệ để chọn.";
      return;
    }
    const signature = itemCandidateSignature(candidates);
    if (itemAutoTimer || itemAttemptSignature === signature) return;
    itemAttemptSignature = signature;
    ui.itemStatus.textContent = `Sẽ ${best.action === "keep" ? "giữ" : "chọn"} ${best.itemName} theo ${best.buildSource} — ${best.reasons[0] || "điểm phù hợp cao nhất"}.`;
    itemAutoTimer = setTimeout(() => {
      itemAutoTimer = null;
      const currentCandidates = itemCandidates();
      const currentSignature = itemCandidateSignature(currentCandidates);
      const currentRanked = currentCandidates.map((candidate) => scoreItemCandidate(candidate, itemBuildFacts())).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
      const currentBest = currentRanked[0];
      if (!state.autoPickItems || !itemScreenVisible() || !isItemVisible || itemManualOverride || currentSignature !== signature || !currentBest?.element?.isConnected || normalize(currentBest.itemName) !== normalize(best.itemName)) {
        itemAttemptSignature = "";
        updateItemState();
        return;
      }
      pendingItemName = currentBest.itemName;
      currentBest.element.click();
      ui.itemStatus.textContent = `Đã bấm ${currentBest.itemName}; đang chờ game xác nhận lựa chọn.`;
      if (itemWatchdogTimer) clearTimeout(itemWatchdogTimer);
      itemWatchdogTimer = setTimeout(() => {
        itemWatchdogTimer = null;
        if (itemScreenVisible() && pendingItemName) {
          pendingItemName = "";
          ui.itemStatus.textContent = `Game chưa nhận click ${currentBest.itemName}; hãy chọn item thủ công.`;
        }
      }, 1800);
    }, AUTO_ITEM_DELAY_MS);
  }

  function itemScreenVisible() {
    const screen = document.querySelector("#scr-item");
    return Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
  }

  function recordManualItemChoice(candidate) {
    if (!candidate) return;
    if (itemAutoTimer) clearTimeout(itemAutoTimer);
    if (itemWatchdogTimer) clearTimeout(itemWatchdogTimer);
    itemAutoTimer = null;
    itemWatchdogTimer = null;
    itemAttemptSignature = "";
    itemManualOverride = true;
    pendingItemName = candidate.item?.name || "";
    ui.itemStatus.textContent = candidate.item
      ? `Đã nhận lựa chọn thủ công: ${candidate.action === "keep" ? "giữ" : "chọn"} ${candidate.item.name}.`
      : "Item chưa nhận diện; extension không ghi nhận tên item này.";
  }

  function onGameItemCardClick(event) {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest("#item-cards .card") || target?.closest('#item-cards button, #item-cards [role="button"]') || target?.closest("#item-cards > *");
    if (card) recordManualItemChoice(itemCandidateFromCard(card));
  }

  function clearItemTracking() {
    if (itemAutoTimer) clearTimeout(itemAutoTimer);
    if (itemWatchdogTimer) clearTimeout(itemWatchdogTimer);
    itemAutoTimer = null;
    itemWatchdogTimer = null;
    itemAttemptSignature = "";
    pendingItemName = "";
    itemManualOverride = false;
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
    const partnerPair = getPartnerBuildBondPair();
    if (partnerPair) {
      const row = document.createElement("div");
      row.className = "recommendation best";
      const title = document.createElement("div");
      title.className = "recommendation-head";
      const names = document.createElement("strong");
      names.textContent = `Move set Partner: ${partnerPair.names.join(" + ")}`;
      const source = document.createElement("span");
      source.className = "score";
      source.textContent = partnerPair.source === "guide" ? "build" : "gợi ý";
      title.append(names, source);
      const reason = document.createElement("p");
      const learned = new Set(state.learnedMoves.map((move) => normalize(move.name)));
      const learnedCount = partnerPair.names.filter((name) => learned.has(normalize(name))).length;
      reason.textContent = partnerPair.source === "guide"
        ? `Nguồn build chỉ rõ cặp này; đã có ${learnedCount}/2 move trong lượt.`
        : `Ưu tiên theo độ phối hợp và thứ tự move set; đã có ${learnedCount}/2 move trong lượt.`;
      row.append(title, reason);
      ui.fusions.append(row);
    }
    if (moves.length < 2) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = partnerPair ? "Học đủ hai move của cặp ưu tiên để xem gợi ý ghép hiện tại." : "Học thêm skill để xem các cặp kết hợp.";
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
      message.textContent = "Các thẻ chưa khớp đủ dữ liệu để xếp hạng đáng tin cậy. Hãy cân nhắc theo tình trạng run hoặc kiểm tra lại Pokémon/build.";
      ui.recommendations.append(message);
      for (const candidate of candidates) {
        const fallback = document.createElement("div");
        fallback.className = "recommendation";
        fallback.textContent = candidate.text.slice(0, 90) || "Lựa chọn chưa nhận diện";
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
    if (!card || !event.isTrusted) return;
    stopAutoPickForManualChoice();
    trackGameSelection(candidateFromCard(card));
  }

  function onGameLevelUpKeydown(event) {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.composedPath().includes(host)) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (isItemVisible) {
      const itemIndex = { "1": 0, "2": 1 }[event.key];
      const itemCandidate = itemIndex === undefined ? null : itemCandidates()[itemIndex];
      if (itemCandidate && event.isTrusted) recordManualItemChoice(itemCandidate);
      return;
    }
    if (isBondVisible) {
      const bondIndex = { "1": 0, "2": 1, "3": 2, "4": 3 }[event.key];
      const bondCandidate = bondIndex === undefined ? null : bondCandidates()[bondIndex];
      if (bondCandidate && event.isTrusted) recordManualBondChoice(bondCandidate);
      return;
    }
    if (!isLevelUpVisible) return;
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
    .quiet-button:disabled, .text-button:disabled { opacity: .55; cursor: wait; }
    .types { min-height: 26px; display: flex; align-items: center; gap: 6px; margin: 5px 0 8px; }
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
    .recommendations, .build-list, .moveset-list { display: grid; gap: 6px; }
    .recommendation { padding: 8px 9px; border: 1px solid #394760; border-radius: 9px; background: #172235; }
    .recommendation.best { border-color: #c49b45; background: #2a281f; }
    .recommendation-head { display: flex; gap: 8px; justify-content: space-between; align-items: flex-start; }
    .recommendation-head strong { font-size: 12px; line-height: 1.3; }
    .score { flex: 0 0 auto; color: #f5c76b; font-size: 10px; font-weight: 800; }
    .recommendation p { margin: 4px 0 0; color: #aebbd0; font-size: 10px; line-height: 1.35; }
    .fusion-mark { display: block; margin: 5px 0 0 auto; }
    .build-item { display: flex; justify-content: space-between; gap: 8px; padding: 5px 7px; background: #172235; border-radius: 7px; font-size: 11px; }
    .moveset-item span:first-child { min-width: 0; }
    .moveset-source { margin: 0; line-height: 1.35; }
    .build-source-link { color: #9bc6ff; font-size: 10px; }
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
})();
