(() => {
  "use strict";

  if (!document.querySelector("#game") || !document.querySelector("#scr-levelup") || !document.querySelector("#cards")) return;

  const STATE_KEY = "psba_player_state_v1";
  const MAX_MOVE_SLOTS = 4;
  const MAX_BOND_GROUP_SIZE = 4;
  const MAX_MOVES_WITH_BONDS = 16;
  const AUTO_PICK_MIN_SCORE = 6;
  const AUTO_PICK_NEAR_TIE_GAP = 6;
  const AUTO_PICK_DELAY_MS = 750;
  const AUTO_REROLL_DELAY_MS = 650;
  const AUTO_REROLL_VERIFY_MS = 700;
  const AUTO_BOND_DELAY_MS = 80;
  const AUTO_BOND_READY_POLL_MS = 50;
  const AUTO_BOND_READY_TIMEOUT_MS = 5000;
  const AUTO_ITEM_DELAY_MS = 600;
  const EVO_STATS = ["Power", "Vigor", "Reflexes", "Armor", "Synthesis", "Magnet", "Sprint"];
  const START_MOVE_BY_TYPE = {
    fire: "ember",
    water: "water-gun",
    grass: "vine-whip",
    electric: "thunder-shock",
    psychic: "confusion",
    poison: "sludge",
    ground: "mud-shot",
    flying: "gust",
    bug: "bug-bite",
    rock: "rock-throw",
    ice: "ice-beam",
    fighting: "karate-chop",
    ghost: "shadow-ball",
    dragon: "dragon-rage",
    fairy: "fairy-wind",
    steel: "metal-claw",
    dark: "bite",
    normal: "tackle"
  };
  const START_MOVE_BY_DEX = {
    1: "vine-whip", 4: "ember", 7: "water-gun",
    54: "confusion", 79: "confusion",
    152: "vine-whip", 155: "ember", 158: "water-gun",
    252: "razor-leaf", 255: "ember", 258: "water-gun",
    387: "vine-whip", 390: "ember", 393: "bubble",
    495: "razor-leaf", 498: "ember", 501: "water-gun",
    650: "vine-whip", 653: "ember", 656: "water-gun",
    722: "razor-leaf", 725: "ember", 728: "bubble",
    810: "vine-whip", 813: "ember", 816: "water-gun",
    906: "razor-leaf", 909: "ember", 912: "water-gun"
  };
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
    autoReroll: true,
    autoBuildFromMoveset: false,
    autoBondFromMoveset: false,
    selectedBuild: null,
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
  let autoRerollSignature = "";
  let levelCardMutationVersion = 0;
  let isBondVisible = false;
  let bondAutoTimer = null;
  let bondWatchdogTimer = null;
  let bondAttemptSignature = "";
  let bondPendingFirstMove = "";
  let bondPendingSecondMove = "";
  let bondPendingFirstGroup = [];
  let bondPendingSecondGroup = [];
  let bondPendingStartedAt = 0;
  let bondManualOverride = false;
  let isItemVisible = false;
  let itemAutoTimer = null;
  let itemWatchdogTimer = null;
  let itemAttemptSignature = "";
  let buildConfigDraft = null;
  let buildConfigFeedback = "";
  let pendingItemName = "";
  let itemManualOverride = false;
  let lastBuildFetchPokemon = "";
  let buildFetchInFlight = "";
  let lastTrackedSelectionSignature = "";
  let lastTrackedSelectionAt = 0;

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
      <section id="psba-build-screen" class="build-screen" aria-label="Tự build move set" hidden>
        <div class="build-screen-header">
          <button id="psba-build-back" class="quiet-button build-back" type="button">← Trợ lý</button>
          <div class="build-screen-heading"><div class="eyebrow">PARTNER MOVE BUILD</div><strong>Tự build move set</strong><small id="psba-build-partner">Chưa chọn Partner</small></div>
          <button id="psba-build-close" class="icon-button" type="button" aria-label="Đóng màn hình build">×</button>
        </div>
        <div id="psba-build-config" class="build-config">
          <div class="build-config-intro">
            <p class="muted">Move mở đầu đang chọn của Partner được thêm sẵn. Danh sách gồm move hệ Normal, các hệ của Partner và move mở đầu; chọn tối đa bốn move, sắp thứ tự ưu tiên và đánh dấu cặp Bond đầu tiên.</p>
            <div id="psba-build-config-summary" class="build-config-summary"></div>
            <div id="psba-build-config-bond" class="build-config-bond"></div>
          </div>
          <div id="psba-build-config-moves" class="build-config-moves"></div>
          <div class="build-config-footer">
            <p id="psba-build-config-status" class="muted auto-status"></p>
            <div class="build-config-actions"><button id="psba-build-config-cancel" class="quiet-button" type="button">Hủy</button><button id="psba-build-config-confirm" class="primary-button" type="button" disabled>Xác nhận & bật tự chọn + build + Bond</button></div>
          </div>
        </div>
      </section>
      <div id="psba-main-view" class="body">
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
        <button id="psba-configure-build" class="primary-button" type="button" disabled>Tự build move set</button>
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
        <label class="auto-pick-row"><span><input id="psba-auto-reroll" type="checkbox"> Tự reroll thẻ yếu</span></label>
        <p id="psba-auto-status" class="muted auto-status">Reroll khi điểm cao nhất dưới 7 hoặc không có thẻ theo move set; sau đó tự chọn thẻ tốt nhất còn lại.</p>

        <div class="section-title"><span>Item phù hợp cho lượt này</span><small id="psba-item-label">chờ item</small></div>
        <div id="psba-item-recommendations" class="recommendations"><p class="muted">Khi item xuất hiện, extension sẽ xếp hạng theo Partner, move set và Bond.</p></div>
        <label class="auto-pick-row"><span><input id="psba-auto-items" type="checkbox"> Tự chọn item</span></label>
        <p id="psba-item-status" class="muted auto-status">Đang ưu tiên hiệu quả cho Partner, move set và Bond hiện tại.</p>

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
    mainView: shadow.querySelector("#psba-main-view"),
    buildScreen: shadow.querySelector("#psba-build-screen"),
    buildPartner: shadow.querySelector("#psba-build-partner"),
    buildBack: shadow.querySelector("#psba-build-back"),
    buildClose: shadow.querySelector("#psba-build-close"),
    status: shadow.querySelector("#psba-status"),
    pokemon: shadow.querySelector("#psba-pokemon"),
    pokemonList: shadow.querySelector("#psba-pokemon-list"),
    types: shadow.querySelector("#psba-types"),
    strategy: shadow.querySelector("#psba-strategy"),
    autoPick: shadow.querySelector("#psba-auto-pick"),
    autoReroll: shadow.querySelector("#psba-auto-reroll"),
    autoStatus: shadow.querySelector("#psba-auto-status"),
    autoItems: shadow.querySelector("#psba-auto-items"),
    itemStatus: shadow.querySelector("#psba-item-status"),
    itemLabel: shadow.querySelector("#psba-item-label"),
    itemRecommendations: shadow.querySelector("#psba-item-recommendations"),
    autoBuild: shadow.querySelector("#psba-auto-build"),
    buildModeStatus: shadow.querySelector("#psba-build-mode-status"),
    configureBuild: shadow.querySelector("#psba-configure-build"),
    buildConfigMoves: shadow.querySelector("#psba-build-config-moves"),
    buildConfigSummary: shadow.querySelector("#psba-build-config-summary"),
    buildConfigBond: shadow.querySelector("#psba-build-config-bond"),
    buildConfigStatus: shadow.querySelector("#psba-build-config-status"),
    buildConfigConfirm: shadow.querySelector("#psba-build-config-confirm"),
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
  ui.buildBack.addEventListener("click", returnToBuildAssistant);
  ui.buildClose.addEventListener("click", () => {
    returnToBuildAssistant();
    setPanelOpen(false);
  });
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
  ui.autoReroll.addEventListener("change", () => {
    state.autoReroll = ui.autoReroll.checked;
    autoRerollSignature = "";
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
      ? "Đang tự chọn item theo hiệu quả ước tính cho Partner, move set và Bond."
      : "Tự chọn item đang tắt; extension vẫn xếp hạng để bạn chọn.";
    updateItemState();
  });
  ui.autoBuild.addEventListener("change", () => {
    state.autoBuildFromMoveset = Boolean(ui.autoBuild.checked && hasAutoBuildPlan());
    ui.autoBuild.checked = state.autoBuildFromMoveset;
    persistState();
    renderPartnerBuild();
    refreshRecommendations();
  });
  ui.configureBuild.addEventListener("click", openBuildConfigurator);
  shadow.querySelector("#psba-build-config-cancel").addEventListener("click", closeBuildConfigurator);
  ui.buildConfigConfirm.addEventListener("click", confirmBuildConfiguration);
  ui.buildConfigMoves.addEventListener("change", onBuildConfigMoveChange);
  ui.buildConfigMoves.addEventListener("click", onBuildConfigMoveClick);
  ui.autoBond.addEventListener("change", () => {
    state.autoBondFromMoveset = Boolean(ui.autoBond.checked && hasAutoBuildPlan());
    ui.autoBond.checked = state.autoBondFromMoveset;
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    bondAutoTimer = null;
    bondAttemptSignature = "";
    bondManualOverride = false;
    persistState();
    ui.bondStatus.textContent = state.autoBondFromMoveset
      ? "Đang chờ Bond; ghép cặp mở đầu rồi thêm từng move theo thứ tự build Partner."
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
  ui.autoReroll.checked = state.autoReroll;
  ui.autoItems.checked = state.autoPickItems;

  const cardsRoot = document.querySelector("#cards");
  const bondCardsRoot = document.querySelector("#bond-cards");
  const itemCardsRoot = document.querySelector("#item-cards");
  cardsRoot.addEventListener("click", onGameCardClick, true);
  bondCardsRoot?.addEventListener("click", onGameBondCardClick, true);
  itemCardsRoot?.addEventListener("click", onGameItemCardClick, true);
  document.addEventListener("keydown", onGameLevelUpKeydown, true);
  const observer = new MutationObserver((records) => {
    if (records.some((record) => cardsRoot.contains(record.target))) levelCardMutationVersion += 1;
    observePartnerName();
    updateLevelUpState();
    updateBondState();
    updateItemState();
    updateGameOverState();
  });
  for (const selector of ["#cards", "#scr-levelup", "#lvl-reroll", "#scr-bond", "#bond-sub", "#bond-cards", "#scr-item", "#item-cards", "#scr-over", "#menu-partner-name", "#res-name", "#starter-info"]) {
    const element = document.querySelector(selector);
    if (element) observer.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "data-id", "data-move", "data-item", "title", "aria-label", "disabled", "aria-disabled", "data-count", "data-remaining", "data-rerolls", "data-tap"] });
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
      autoReroll: state.autoReroll,
      autoBuildFromMoveset: state.autoBuildFromMoveset,
      autoBondFromMoveset: state.autoBondFromMoveset,
      selectedBuild: state.selectedBuild ? {
        pokemon: state.selectedBuild.pokemon,
        moves: [...state.selectedBuild.moves],
        firstPair: [...state.selectedBuild.firstPair]
      } : null,
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
        state.autoReroll = value.autoReroll === undefined ? true : Boolean(value.autoReroll);
        state.autoBuildFromMoveset = Boolean(value.autoBuildFromMoveset);
        state.autoBondFromMoveset = Boolean(value.autoBondFromMoveset);
        state.selectedBuild = value.selectedBuild && typeof value.selectedBuild.pokemon === "string"
          ? {
              pokemon: value.selectedBuild.pokemon,
              moves: Array.isArray(value.selectedBuild.moves) ? value.selectedBuild.moves.filter((item) => typeof item === "string").slice(0, MAX_MOVE_SLOTS) : [],
              firstPair: Array.isArray(value.selectedBuild.firstPair) ? value.selectedBuild.firstPair.filter((item) => typeof item === "string").slice(0, 2) : []
            }
          : null;
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
                ? value.partnerBuild.bondGroups.map((group) => Array.isArray(group) ? group.filter((name) => typeof name === "string").slice(0, MAX_BOND_GROUP_SIZE) : []).filter((group) => group.length >= 2).slice(0, 4)
                : []
            }
          : null;
        state.learnedMoves = Array.isArray(value.learnedMoves)
          ? value.learnedMoves.filter((item) => item && typeof item.name === "string").slice(0, MAX_MOVES_WITH_BONDS).map((item) => ({
              name: item.name,
              level: Math.max(1, Math.min(5, Number(item.level) || 1)),
              evolved: Boolean(item.evolved),
              origin: item.origin === "starting" ? "starting" : "",
              startSource: item.origin === "starting" && item.startSource === "saved" ? "saved" : "default"
            }))
          : [];
        state.fusedGroups = Array.isArray(value.fusedGroups)
          ? value.fusedGroups.map((group) => Array.isArray(group) ? group.filter((name) => typeof name === "string").slice(0, MAX_BOND_GROUP_SIZE) : []).filter((group) => group.length >= 2).slice(0, MAX_MOVE_SLOTS)
          : [];
        state.statPicks = Array.isArray(value.statPicks) ? value.statPicks.filter((item) => typeof item === "string").slice(-12) : [];
        state.heldItem = typeof value.heldItem === "string" ? value.heldItem : "";
        state.lastLevel = Number.isFinite(Number(value.lastLevel)) ? Number(value.lastLevel) : 0;
        if (!hasAutoBuildPlan()) {
          state.autoBuildFromMoveset = false;
          state.autoBondFromMoveset = false;
        }
      }
      syncUiFromState();
      loadPartnerMovesetIfNeeded();
      updateBondState();
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
      updateLevelUpState();
      loadPartnerMovesetIfNeeded();
      updateBondState();
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
    ui.autoReroll.checked = state.autoReroll;
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

  function moveNameFromId(id) {
    const key = normalize(String(id || "").replace(/[-_]+/g, " "));
    return moveData.find((move) => normalize(move.name) === key)?.name || "";
  }

  function parseGameSave(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const save = JSON.parse(raw);
      return save && typeof save === "object" ? save : null;
    } catch (_error) {
      return null;
    }
  }

  function gameSaveForPartner(pokemon) {
    if (!pokemon?.id) return null;
    const partnerId = Number(pokemon.id);
    const activeName = normalize(document.querySelector("#user-pill span[translate='no']")?.textContent);
    const candidates = [];
    try {
      const sessionKey = localStorage.getItem("ps.session");
      if (sessionKey) {
        const localSave = parseGameSave(`ps.save.${sessionKey}`);
        if (Number(localSave?.partner) === partnerId) candidates.push(localSave);
      }
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith("ps.cloud.")) continue;
        const cloudSave = parseGameSave(key);
        if (Number(cloudSave?.partner) === partnerId) candidates.push(cloudSave);
      }
    } catch (_error) {
      return null;
    }
    if (activeName) {
      return candidates
        .filter((save) => normalize(save.name) === activeName)
        .sort((a, b) => Number(b.updated) - Number(a.updated))[0] || null;
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  function partnerStartingMoves(pokemon) {
    if (!pokemon) return [];
    const dex = Number(pokemon.id);
    const gameSave = gameSaveForPartner(pokemon);
    const upgrade = gameSave?.pupg?.[dex] || {};
    const selectedStart = gameSave?.pstart?.[dex];
    const baseStart = START_MOVE_BY_DEX[dex] || START_MOVE_BY_TYPE[normalize(pokemon.types?.[0])]
      || START_MOVE_BY_TYPE.normal;
    const startId = upgrade.start && selectedStart && moveNameFromId(selectedStart)
      ? selectedStart
      : baseStart;
    const moves = [{ id: startId, source: upgrade.start && selectedStart === startId ? "saved" : "default" }];

    const selectedSecond = gameSave?.pstart2?.[dex];
    if (upgrade.start2 && upgrade.moves && selectedSecond && selectedSecond !== startId && moveNameFromId(selectedSecond)) {
      moves.push({ id: selectedSecond, source: "saved" });
    }
    return moves
      .map((item) => ({ name: moveNameFromId(item.id), source: item.source }))
      .filter((item) => item.name)
      .slice(0, MAX_MOVE_SLOTS);
  }

  function ensurePartnerStartingMoves() {
    if (state.learnedMoves.some((move) => move.origin === "starting")) return false;
    const starts = partnerStartingMoves(currentPokemon());
    if (!starts.length) return false;
    const names = starts.map((move) => normalize(move.name));
    const existingStarts = state.learnedMoves.filter((move) => move.origin === "starting").map((move) => normalize(move.name));
    if (names.length === existingStarts.length && names.every((name, index) => name === existingStarts[index])) return false;

    const remaining = state.learnedMoves.filter((move) => !names.includes(normalize(move.name)) && move.origin !== "starting");
    const startingMoves = starts.map((move) => {
      const existing = state.learnedMoves.find((item) => normalize(item.name) === normalize(move.name));
      return existing
        ? { ...existing, origin: "starting", startSource: move.source }
        : { name: move.name, level: 1, evolved: false, origin: "starting", startSource: move.source };
    });
    state.learnedMoves = [...startingMoves, ...remaining].slice(0, MAX_MOVES_WITH_BONDS);
    persistState();
    renderBuild();
    return true;
  }

  function hasPartnerBuildForCurrentPokemon() {
    return Boolean(state.partnerBuild && normalize(state.partnerBuild.pokemon) === normalize(state.pokemon) && state.partnerBuild.moves.length);
  }

  function eligiblePartnerMoves() {
    const pokemon = currentPokemon();
    if (!pokemon || !moveData.length) return [];
    const types = new Set(["normal", ...(pokemon.types || []).map(normalize)]);
    const startingMoves = new Set(partnerStartingMoves(pokemon).map((move) => normalize(move.name)));
    return moveData.filter((move) => types.has(normalize(move.type)) || startingMoves.has(normalize(move.name)));
  }

  function hasSelectedBuildForCurrentPokemon() {
    return Boolean(state.selectedBuild
      && normalize(state.selectedBuild.pokemon) === normalize(state.pokemon)
      && Array.isArray(state.selectedBuild.moves)
      && state.selectedBuild.moves.length >= 2
      && Array.isArray(state.selectedBuild.firstPair)
      && state.selectedBuild.firstPair.length === 2);
  }

  function hasAutoBuildPlan() {
    return hasSelectedBuildForCurrentPokemon() || hasPartnerBuildForCurrentPokemon();
  }

  function configuredBuildForCurrentPokemon() {
    if (!hasSelectedBuildForCurrentPokemon()) return null;
    const available = new Map(eligiblePartnerMoves().map((move) => [normalize(move.name), move.name]));
    const moves = [...new Set(state.selectedBuild.moves.map((name) => available.get(normalize(name))).filter(Boolean))].slice(0, MAX_MOVE_SLOTS);
    const firstPair = [...new Set(state.selectedBuild.firstPair.map((name) => available.get(normalize(name))).filter((name) => name && moves.some((item) => normalize(item) === normalize(name))))].slice(0, 2);
    return moves.length >= 2 && firstPair.length === 2 ? { moves, firstPair } : null;
  }

  function activeBuildMoves() {
    const configured = configuredBuildForCurrentPokemon();
    if (configured) {
      return configured.moves.map((name) => ({
        ...(state.partnerBuild?.moves.find((move) => normalize(move.name) === normalize(name)) || {}),
        ...getMoveData(name),
        name
      }));
    }
    return hasPartnerBuildForCurrentPokemon() ? state.partnerBuild.moves : [];
  }

  function activeBuildMoveNames() {
    return activeBuildMoves().map((move) => move.name);
  }

  function setPartnerPokemon(name, manual = false) {
    const nextPokemon = String(name || "").trim();
    const changed = normalize(state.pokemon) !== normalize(nextPokemon);
    if (changed) {
      clearRunTracker();
      state.partnerBuild = null;
      state.selectedBuild = null;
      state.autoBuildFromMoveset = false;
      state.autoBondFromMoveset = false;
      closeBuildConfigurator();
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
      updateBondState();
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
    const hasLearnableMoves = eligiblePartnerMoves().length > 0;
    const hasPlan = hasAutoBuildPlan();
    ui.configureBuild.disabled = !state.pokemon || !hasLearnableMoves;
    ui.configureBuild.textContent = configuredBuildForCurrentPokemon() ? "Chỉnh move set & Bond" : "Tự build move set";
    ui.autoBuild.disabled = !hasPlan;
    ui.autoBuild.checked = Boolean(hasPlan && state.autoBuildFromMoveset);
    ui.autoBond.disabled = !hasPlan;
    ui.autoBond.checked = Boolean(hasPlan && state.autoBondFromMoveset);
    if (!state.pokemon) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Chọn Partner để tải move set tham khảo.";
      ui.moveset.append(message);
      ui.buildModeStatus.textContent = "Chưa chọn Partner.";
      return;
    }
    if (matchingBuild) {
      const source = document.createElement("p");
      source.className = "muted moveset-source";
      source.textContent = "Build cộng đồng để tham khảo; bạn có thể tự tạo move set riêng bên dưới.";
      ui.moveset.append(source);
      for (const [index, move] of state.partnerBuild.moves.entries()) {
        const row = document.createElement("div");
        row.className = "build-item moveset-item";
        const icon = createMoveIcon(getMoveData(move.name));
        const name = document.createElement("span");
        name.textContent = `${index + 1}. ${move.name}${move.role ? ` · ${move.role}` : ""}`;
        const evo = document.createElement("span");
        evo.className = "build-level";
        evo.textContent = moveData.find((item) => normalize(item.name) === normalize(move.name))?.evoStat || "Move";
        if (move.evolves) evo.title = move.evolves;
        row.append(icon, name, evo);
        ui.moveset.append(row);
      }
      const suggestedBond = getPartnerBuildBondPlan();
      if (suggestedBond) {
        const bond = document.createElement("p");
        bond.className = "muted moveset-source";
        bond.textContent = suggestedBond.names.length >= 4
          ? `Lộ trình Bond: ${suggestedBond.firstPair.join(" + ")} → thêm ${suggestedBond.additions.join(" → thêm ")} (mỗi Bond sau thêm một move vào nhóm).`
          : `Bond ưu tiên: ${suggestedBond.firstPair.join(" + ")} · ${suggestedBond.source === "user" ? "theo lựa chọn của bạn" : suggestedBond.source === "guide" ? "theo hướng dẫn build" : "xếp theo phối hợp và thứ tự move"}`;
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
    } else {
      const message = document.createElement("p");
      message.className = "muted moveset-source";
      message.textContent = hasLearnableMoves
        ? `Chưa có build tham khảo cho ${state.pokemon}. Bạn vẫn có thể tự tạo move set từ danh sách move có thể học.`
        : "Đang chờ dữ liệu move để tạo danh sách build riêng.";
      ui.moveset.append(message);
    }

    const configured = configuredBuildForCurrentPokemon();
    if (configured) {
      const selected = document.createElement("p");
      selected.className = "moveset-source selected-build-summary";
      selected.textContent = `Đang dùng: ${configured.moves.join(" → ")} · Bond đầu: ${configured.firstPair.join(" + ")}`;
      ui.moveset.append(selected);
    }
    ui.buildModeStatus.textContent = state.autoBuildFromMoveset
      ? configuredBuildForCurrentPokemon()
        ? "Đang ưu tiên các move theo thứ tự bạn đã xác nhận."
        : "Đang ưu tiên move và thẻ theo move set tham khảo."
      : "Bật tự build để ưu tiên move set này khi chọn thẻ.";
    ui.bondStatus.textContent = state.autoBondFromMoveset
      ? configuredBuildForCurrentPokemon()
        ? "Đang chờ Bond; sẽ ghép cặp bạn chọn và nối move theo thứ tự đã xác nhận."
        : "Đang chờ Bond; sẽ ưu tiên nhóm đang mở rồi thêm move kế tiếp trong lộ trình build."
      : "Bật để tự chọn Bond theo thứ tự game cho phép, tối đa 4 move trong một nhóm.";
    if (!ui.buildScreen.hidden) renderBuildConfigurator();
  }

  const MOVE_TYPE_COLORS = {
    normal: "#b9b4a6", fire: "#f07d45", water: "#54a8f5", grass: "#64bd75", electric: "#f4cf50",
    ice: "#87d8dc", fighting: "#dc765c", poison: "#aa73c5", ground: "#d5ad69", flying: "#a8b6e9",
    psychic: "#ec79a0", bug: "#a4b846", rock: "#bea76c", ghost: "#8072bf", dragon: "#7665dc",
    dark: "#776d7b", steel: "#9ba9bb", fairy: "#e897ca"
  };
  const MOVE_TYPE_MARKS = {
    normal: "N", fire: "F", water: "W", grass: "G", electric: "E", ice: "I", fighting: "Fi",
    poison: "P", ground: "Gr", flying: "Fl", psychic: "Ps", bug: "B", rock: "R", ghost: "Gh",
    dragon: "Dr", dark: "D", steel: "St", fairy: "Fa"
  };
  const MOVE_KIND_MARKS = {
    projectile: "•", homing: "⌖", bounce: "↗", chain: "⌁", beam: "━", charge: "ϟ", melee: "✦",
    spin: "⟳", orbit: "◌", aura: "◎", nova: "✧", burst: "✧", cone: "◢", spray: "≋", dash: "➤",
    trail: "∿", mine: "✹", meteor: "✦", turret: "▣", buff: "+", vortex: "◉", quake: "⌁", shove: "↗", stun: "✴"
  };

  function createMoveIcon(move) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 40 40");
    icon.setAttribute("class", "move-icon");
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", move ? `${move.type} ${move.kind} icon for ${move.name}` : "Move icon");
    const typeKey = normalize(move?.type);
    const color = MOVE_TYPE_COLORS[typeKey] || "#8795aa";
    const typeMark = MOVE_TYPE_MARKS[typeKey] || "?";
    const kindMark = MOVE_KIND_MARKS[normalize(move?.kind)] || "•";
    const background = document.createElementNS(icon.namespaceURI, "rect");
    background.setAttribute("x", "1");
    background.setAttribute("y", "1");
    background.setAttribute("width", "38");
    background.setAttribute("height", "38");
    background.setAttribute("rx", "10");
    background.setAttribute("fill", "#263b68");
    background.setAttribute("stroke", "#89a7df");
    background.setAttribute("stroke-width", "1.5");
    const emblem = document.createElementNS(icon.namespaceURI, "circle");
    emblem.setAttribute("cx", "18");
    emblem.setAttribute("cy", "18");
    emblem.setAttribute("r", "12.5");
    emblem.setAttribute("fill", color);
    emblem.setAttribute("stroke", "#fff");
    emblem.setAttribute("stroke-opacity", ".75");
    emblem.setAttribute("stroke-width", "1.2");
    const typeText = document.createElementNS(icon.namespaceURI, "text");
    typeText.setAttribute("x", "18");
    typeText.setAttribute("y", "21");
    typeText.setAttribute("text-anchor", "middle");
    typeText.setAttribute("font-size", typeMark.length > 1 ? "7" : "10");
    typeText.setAttribute("font-weight", "900");
    typeText.setAttribute("fill", "#101827");
    typeText.textContent = typeMark;
    const badge = document.createElementNS(icon.namespaceURI, "circle");
    badge.setAttribute("cx", "30");
    badge.setAttribute("cy", "30");
    badge.setAttribute("r", "8");
    badge.setAttribute("fill", "#101827");
    badge.setAttribute("stroke", "#f5c76b");
    badge.setAttribute("stroke-width", "1");
    const kindText = document.createElementNS(icon.namespaceURI, "text");
    kindText.setAttribute("x", "30");
    kindText.setAttribute("y", "33");
    kindText.setAttribute("text-anchor", "middle");
    kindText.setAttribute("font-size", "9");
    kindText.setAttribute("font-weight", "900");
    kindText.setAttribute("fill", "#fff");
    kindText.textContent = kindMark;
    icon.append(background, emblem, typeText, badge, kindText);
    return icon;
  }

  function openBuildConfigurator() {
    const eligibleMoves = eligiblePartnerMoves();
    if (!eligibleMoves.length) return;
    if (!buildConfigDraft || normalize(buildConfigDraft.pokemon) !== normalize(state.pokemon)) {
      const configured = configuredBuildForCurrentPokemon();
      const availableByName = new Map(eligibleMoves.map((move) => [normalize(move.name), move.name]));
      const startingMoves = partnerStartingMoves(currentPokemon())
        .map((move) => availableByName.get(normalize(move.name)))
        .filter(Boolean)
        .slice(0, MAX_MOVE_SLOTS);
      buildConfigDraft = {
        pokemon: state.pokemon,
        moves: configured ? [...configured.moves] : startingMoves,
        firstPair: configured
          ? [...configured.firstPair]
          : startingMoves.length >= 2 ? startingMoves.slice(0, 2) : []
      };
    }
    buildConfigFeedback = "";
    ui.buildPartner.textContent = `${state.pokemon} · ${currentPokemon()?.types?.join(" / ") || "Partner"}`;
    ui.mainView.hidden = true;
    ui.buildScreen.hidden = false;
    ui.panel.classList.add("build-mode");
    setPanelOpen(true);
    renderBuildConfigurator();
  }

  function closeBuildConfigurator() {
    buildConfigDraft = null;
    buildConfigFeedback = "";
    returnToBuildAssistant();
  }

  function returnToBuildAssistant() {
    buildConfigFeedback = "";
    ui.buildScreen.hidden = true;
    ui.mainView.hidden = false;
    ui.panel.classList.remove("build-mode");
  }

  function renderBuildConfigurator() {
    if (!buildConfigDraft || normalize(buildConfigDraft.pokemon) !== normalize(state.pokemon)) return;
    const scrollTop = ui.buildConfigMoves.scrollTop;
    ui.buildConfigMoves.replaceChildren();
    const selectedNames = buildConfigDraft.moves;
    const availableMoves = eligiblePartnerMoves();
    const startingNames = new Set(partnerStartingMoves(currentPokemon()).map((move) => normalize(move.name)));
    for (const move of availableMoves) {
      const selectedIndex = selectedNames.findIndex((name) => normalize(name) === normalize(move.name));
      const selected = selectedIndex >= 0;
      const inFirstBond = buildConfigDraft.firstPair.some((name) => normalize(name) === normalize(move.name));
      const row = document.createElement("div");
      row.className = `build-config-move${selected ? " selected" : ""}`;
      row.dataset.move = move.name;
      const icon = createMoveIcon(getMoveData(move.name));
      const details = document.createElement("div");
      details.className = "build-config-details";
      const title = document.createElement("strong");
      title.textContent = `${selected ? `${selectedIndex + 1}. ` : ""}${move.name}`;
      const meta = document.createElement("small");
      meta.textContent = [move.type, move.category, move.kind, startingNames.has(normalize(move.name)) ? "Mở đầu" : ""].filter(Boolean).join(" · ");
      const description = document.createElement("small");
      description.className = "build-config-description";
      description.textContent = move.description || "Chưa có mô tả move.";
      details.append(title, meta, description);

      const controls = document.createElement("div");
      controls.className = "build-config-controls";
      const includeLabel = document.createElement("label");
      includeLabel.className = "config-choice";
      const include = document.createElement("input");
      include.type = "checkbox";
      include.dataset.role = "include";
      include.checked = selected;
      include.setAttribute("aria-label", `Dùng ${move.name} trong move set`);
      includeLabel.append(include, document.createTextNode(selected ? "Đã thêm" : "+ Thêm"));
      const bondLabel = document.createElement("label");
      bondLabel.className = "config-choice bond-choice";
      const bond = document.createElement("input");
      bond.type = "checkbox";
      bond.dataset.role = "bond";
      bond.checked = inFirstBond;
      bond.disabled = !selected;
      bond.setAttribute("aria-label", `Ưu tiên ${move.name} trong Bond đầu tiên`);
      bondLabel.append(bond, document.createTextNode("Bond đầu"));
      controls.append(includeLabel, bondLabel);

      const order = document.createElement("div");
      order.className = "build-config-order";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "quiet-button order-button";
      up.dataset.direction = "up";
      up.disabled = !selected || selectedIndex === 0;
      up.setAttribute("aria-label", `Ưu tiên ${move.name} cao hơn`);
      up.textContent = "↑";
      const down = document.createElement("button");
      down.type = "button";
      down.className = "quiet-button order-button";
      down.dataset.direction = "down";
      down.disabled = !selected || selectedIndex === selectedNames.length - 1;
      down.setAttribute("aria-label", `Ưu tiên ${move.name} thấp hơn`);
      down.textContent = "↓";
      order.append(up, down);
      row.append(icon, details, controls, order);
      ui.buildConfigMoves.append(row);
    }
    ui.buildConfigMoves.scrollTop = scrollTop;

    const pair = buildConfigDraft.firstPair;
    ui.buildConfigSummary.textContent = `${selectedNames.length}/${MAX_MOVE_SLOTS} move · Ưu tiên: ${selectedNames.join(" → ") || "chưa chọn"}`;
    ui.buildConfigBond.textContent = pair.length === 2
      ? `Bond đầu tiên: ${pair.join(" + ")} · các Bond sau ưu tiên thêm move theo thứ tự trên.`
      : "Chọn đúng hai move bằng ô “Bond đầu” để đặt cặp ghép mở đầu.";
    const valid = selectedNames.length >= 2 && selectedNames.length <= MAX_MOVE_SLOTS && pair.length === 2
      && pair.every((name) => selectedNames.some((item) => normalize(item) === normalize(name)));
    ui.buildConfigStatus.textContent = buildConfigFeedback || (valid
      ? `${selectedNames.length} move đã chọn · thứ tự hiện tại: ${selectedNames.join(" → ")}`
      : `Chọn tối thiểu hai move và đúng hai move cho Bond đầu tiên (tối đa ${MAX_MOVE_SLOTS}).`);
    ui.buildConfigConfirm.disabled = !valid;
  }

  function onBuildConfigMoveChange(event) {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const row = input?.closest("[data-move]");
    if (!input || !row || !buildConfigDraft) return;
    buildConfigFeedback = "";
    const name = row.dataset.move;
    if (input.dataset.role === "include") {
      const index = buildConfigDraft.moves.findIndex((item) => normalize(item) === normalize(name));
      if (input.checked && index < 0) {
        if (buildConfigDraft.moves.length >= MAX_MOVE_SLOTS) {
          buildConfigFeedback = `Chỉ chọn tối đa ${MAX_MOVE_SLOTS} move.`;
          renderBuildConfigurator();
          return;
        }
        buildConfigDraft.moves.push(name);
      } else if (!input.checked && index >= 0) {
        buildConfigDraft.moves.splice(index, 1);
        buildConfigDraft.firstPair = buildConfigDraft.firstPair.filter((item) => normalize(item) !== normalize(name));
      }
    } else if (input.dataset.role === "bond") {
      const index = buildConfigDraft.firstPair.findIndex((item) => normalize(item) === normalize(name));
      if (input.checked && index < 0) {
        if (!buildConfigDraft.moves.some((item) => normalize(item) === normalize(name))) {
          buildConfigFeedback = "Đưa move vào move set trước khi chọn Bond đầu tiên.";
        } else if (buildConfigDraft.firstPair.length >= 2) {
          buildConfigFeedback = "Bond mở đầu cần đúng hai move. Bỏ chọn một move Bond trước.";
        } else {
          buildConfigDraft.firstPair.push(name);
        }
      } else if (!input.checked && index >= 0) {
        buildConfigDraft.firstPair.splice(index, 1);
      }
    }
    renderBuildConfigurator();
  }

  function onBuildConfigMoveClick(event) {
    const button = event.target instanceof Element ? event.target.closest("button[data-direction]") : null;
    const row = button?.closest("[data-move]");
    if (!button || !row || !buildConfigDraft) return;
    const index = buildConfigDraft.moves.findIndex((name) => normalize(name) === normalize(row.dataset.move));
    const next = index + (button.dataset.direction === "up" ? -1 : 1);
    if (index < 0 || next < 0 || next >= buildConfigDraft.moves.length) return;
    [buildConfigDraft.moves[index], buildConfigDraft.moves[next]] = [buildConfigDraft.moves[next], buildConfigDraft.moves[index]];
    buildConfigFeedback = "";
    renderBuildConfigurator();
  }

  function confirmBuildConfiguration() {
    if (!buildConfigDraft || ui.buildConfigConfirm.disabled) return;
    state.selectedBuild = {
      pokemon: state.pokemon,
      moves: [...buildConfigDraft.moves],
      firstPair: [...buildConfigDraft.firstPair]
    };
    state.autoPick = true;
    state.autoBuildFromMoveset = true;
    state.autoBondFromMoveset = true;
    ui.autoPick.checked = true;
    ui.autoBuild.checked = true;
    ui.autoBond.checked = true;
    closeBuildConfigurator();
    persistState();
    renderPartnerBuild();
    refreshRecommendations();
    updateBondState();
    ui.buildModeStatus.textContent = "Đã xác nhận: tự chọn thẻ, build theo move đã chọn và ưu tiên Bond theo cặp cùng thứ tự đã đặt.";
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
    autoRerollSignature = "";
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
        autoRerollSignature = "";
        ui.autoStatus.textContent = "Đang chờ lần lên cấp tiếp theo.";
      }
    }
    if (visible) {
      const level = Number(document.querySelector("#lvl-num")?.textContent?.trim());
      if (level > 0 && state.lastLevel > 2 && level <= 2) clearRunTracker();
      ensurePartnerStartingMoves();
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
    const matches = moveData
      .map((item) => ({ item, name: normalize(item.name), at: normalizedText.indexOf(normalize(item.name)) }))
      .filter((match) => match.at >= 0)
      .sort((a, b) => a.at - b.at || b.name.length - a.name.length);
    const moves = [];
    const occupiedRanges = [];
    for (const match of matches) {
      const end = match.at + match.name.length;
      if (occupiedRanges.some(([start, stop]) => match.at < stop && end > start)) continue;
      occupiedRanges.push([match.at, end]);
      moves.push(match.item);
    }
    const move = moves[0] || null;
    const evolution = /evol|golden|gold card|evolved/.test(normalizedText) || /\bevo\b|evolution|golden/.test(classes);
    const stat = move ? "" : EVO_STATS.find((item) => normalizedText.includes(normalize(item))) || "";
    return { element: card, text: (card.innerText || card.textContent || "").trim().replace(/\s+/g, " "), normalizedText, move, moves, evolution, stat };
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
    if (state.autoBuildFromMoveset && hasAutoBuildPlan()) {
      names.push(...activeBuildMoveNames());
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
      if (state.autoBuildFromMoveset && hasAutoBuildPlan()) {
        const moveSetIndex = activeBuildMoves().findIndex((item) => normalize(item.name) === normalize(move.name));
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
    return `${cardSelectionSignature()}::${scores}::${preferences}::reroll:${rerollControlSignature()}`;
  }

  function levelRerollButton() {
    return document.querySelector("#lvl-reroll");
  }

  function rerollControlSignature() {
    const button = levelRerollButton();
    if (!button) return "missing";
    return `${button.outerHTML}:${Boolean(button.disabled)}:${button.getAttribute("aria-disabled") || ""}`;
  }

  function isRerollAvailable() {
    const button = levelRerollButton();
    if (!button || !button.isConnected || button.disabled || button.hasAttribute("disabled")) return false;
    if (button.getAttribute("aria-disabled") === "true" || button.classList.contains("disabled")) return false;
    if (button.getAttribute("data-tap") === "0") return false;
    if (button.classList.contains("hidden") || getComputedStyle(button).display === "none" || getComputedStyle(button).visibility === "hidden") return false;

    const countAttributes = ["data-count", "data-remaining", "data-rerolls"];
    for (const element of [button, ...button.querySelectorAll("[data-count], [data-remaining], [data-rerolls]")]) {
      for (const attribute of countAttributes) {
        const raw = element.getAttribute(attribute);
        if (raw !== null && /^\s*\d+\s*$/.test(raw) && Number(raw) <= 0) return false;
      }
    }

    const text = button.innerText || button.textContent || "";
    const countMatch = text.match(/(?:rerolls?|remaining|left|available|lượt)\D{0,8}(\d+)/i)
      || text.match(/(\d+)\s*(?:rerolls?|rolls?|left|remaining|lượt)/i);
    if (countMatch && Number(countMatch[1]) <= 0) return false;
    return true;
  }

  function unfinishedBuildMoveNames() {
    const plannedNames = activeBuildMoveNames();
    return plannedNames.filter((name) => {
      const learned = state.learnedMoves.find((item) => normalize(item.name) === normalize(name));
      return !learned || !learned.evolved;
    });
  }

  function candidateMatchesActiveMoveSet(candidate) {
    if (candidate.evolution) return true;
    const unfinishedMoves = unfinishedBuildMoveNames();
    if (candidate.move) {
      return unfinishedMoves.some((name) => normalize(name) === normalize(candidate.move.name));
    }
    if (candidate.stat) {
      const prioritizedStats = activeCardPriorityNames();
      if (prioritizedStats.some((name) => normalize(name) === normalize(candidate.stat))) return true;
      return unfinishedMoves.some((name) => normalize(getMoveData(name)?.evoStat) === normalize(candidate.stat));
    }
    return false;
  }

  function autoRerollReason(candidates) {
    const best = candidates[0];
    if (!best) return "";
    if (best.score <= AUTO_PICK_MIN_SCORE) return `điểm cao nhất chỉ ${best.score}, dưới ngưỡng 7`;
    if (state.autoBuildFromMoveset && hasAutoBuildPlan() && unfinishedBuildMoveNames().length
      && !candidates.some(candidateMatchesActiveMoveSet)) {
      return "cả ba thẻ đều không khớp move set Partner";
    }
    return "";
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

    const rerollReason = autoRerollReason(candidates);
    if (state.autoReroll && rerollReason && autoRerollSignature !== planSignature && isRerollAvailable()) {
      ui.autoStatus.textContent = `Đang reroll vì ${rerollReason}…`;
      pendingAutoPickSignature = planSignature;
      autoPickTimer = setTimeout(() => {
        autoPickTimer = null;
        pendingAutoPickSignature = "";
        const currentScreen = document.querySelector("#scr-levelup");
        const currentCandidates = cardNodes().map(candidateFromCard).filter((candidate) => candidate.text).map(scoreCandidate).sort((a, b) => b.score - a.score);
        if (!state.autoPick || !state.autoReroll || !isLevelUpVisible || !currentScreen || currentScreen.classList.contains("hidden") || getComputedStyle(currentScreen).display === "none"
          || scoredCandidateSignature(currentCandidates) !== planSignature || !autoRerollReason(currentCandidates) || !isRerollAvailable()) return;

        const rerollButton = levelRerollButton();
        const cardsBeforeReroll = cardSelectionSignature();
        const cardMutationVersionBefore = levelCardMutationVersion;
        const controlBeforeReroll = rerollControlSignature();
        autoRerollSignature = planSignature;
        rerollButton.click();
        ui.autoStatus.textContent = `Reroll đã bấm (${rerollReason}); đang chờ thẻ mới…`;
        setTimeout(() => {
          const cardsChanged = cardSelectionSignature() !== cardsBeforeReroll;
          const cardContentChanged = levelCardMutationVersion !== cardMutationVersionBefore;
          const controlChanged = rerollControlSignature() !== controlBeforeReroll;
          if (cardsChanged || cardContentChanged || controlChanged) {
            autoRerollSignature = "";
            updateLevelUpState();
            return;
          }
          ui.autoStatus.textContent = "Game không xác nhận reroll; đang dùng lựa chọn tốt nhất hiện có.";
          refreshRecommendations();
        }, AUTO_REROLL_VERIFY_MS);
      }, AUTO_REROLL_DELAY_MS);
      return;
    }

    const decision = chooseAutoCandidate(candidates);
    const best = decision.candidate;
    const autoEligible = Boolean(best && (decision.gap <= AUTO_PICK_NEAR_TIE_GAP || best.score > AUTO_PICK_MIN_SCORE));
    if (!autoEligible) {
      const rerollNote = state.autoReroll && rerollReason
        ? autoRerollSignature === planSignature
          ? "Reroll không làm thay đổi thẻ; "
          : "Không còn lượt reroll; "
        : "";
      ui.autoStatus.textContent = `${rerollNote}chênh ${Math.round(decision.gap)} điểm và thẻ đầu chưa vượt 6 điểm; đang chờ lựa chọn rõ hơn.`;
      return;
    }

    const ruleText = decision.rule === "move-priority"
      ? `theo ưu tiên move #${decision.priorityIndex + 1}`
      : decision.rule === "build-direction" ? `theo hướng ${STRATEGIES[state.strategy]}` : "theo điểm cao nhất";
    const rerollNote = state.autoReroll && rerollReason
      ? autoRerollSignature === planSignature
        ? "reroll không đổi thẻ, "
        : "đã hết lượt reroll, "
      : "";
    ui.autoStatus.textContent = `Sẽ ${rerollNote}tự chọn ${best.move?.name || best.text.slice(0, 32)} ${ruleText} sau khi thẻ ổn định.`;
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

  function fusionGroupScore(moves) {
    const unique = [];
    for (const move of moves) {
      if (move && !unique.some((item) => normalize(item.name) === normalize(move.name))) unique.push(move);
    }
    const profiles = unique.map((move) => ({ move, profile: moveProfile(move) }));
    const damage = profiles.filter((item) => !item.profile.isBuff);
    let score = 0;
    const reasons = [];
    const add = (points, reason) => {
      score += points;
      if (reason) reasons.push(reason);
    };

    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const pair = fusionPairScore(unique[i], unique[j]);
        score += pair.score;
        reasons.push(...pair.reasons);
      }
    }

    if (damage.length >= 2) add(5, "giữ ít nhất hai nguồn sát thương trong nhóm");
    if (profiles.some((item) => item.profile.area) && profiles.some((item) => item.profile.targeted)) {
      add(8, "bao phủ cả đám đông và mục tiêu đơn/boss");
    }
    if (profiles.some((item) => item.profile.control) && damage.length) {
      add(6, "khống chế tạo khoảng trống cho đòn gây sát thương");
    }
    if (profiles.some((item) => item.profile.sustain) && damage.length) {
      add(4, "cân bằng sát thương với khả năng hồi phục");
    }

    const uniqueReasons = [...new Set(reasons)];
    return { score, reasons: uniqueReasons.slice(0, 4) };
  }

  function getPartnerBuildBondPlan() {
    const configured = configuredBuildForCurrentPokemon();
    if (configured) {
      const names = [
        ...configured.firstPair,
        ...configured.moves.filter((name) => !configured.firstPair.some((pairName) => normalize(pairName) === normalize(name)))
      ];
      const groupScore = fusionGroupScore(names.map(getMoveData).filter(Boolean));
      return {
        names,
        firstPair: [...configured.firstPair],
        additions: names.slice(2),
        source: "user",
        score: groupScore.score,
        reasons: ["theo move set và cặp Bond do người chơi xác nhận", ...groupScore.reasons].slice(0, 4)
      };
    }
    if (!hasPartnerBuildForCurrentPokemon()) return null;
    const moves = state.partnerBuild.moves
      .map((item, index) => ({ move: getMoveData(item.name), index }))
      .filter((item) => item.move)
      .filter((item, index, list) => list.findIndex((other) => normalize(other.move.name) === normalize(item.move.name)) === index)
      .slice(0, MAX_MOVE_SLOTS);
    if (moves.length < 2) return null;

    let selected = [];
    let source = "moveset";
    const explicit = (state.partnerBuild.bondGroups || []).find((group) => {
      const matching = group.map((name) => moves.find((item) => normalize(item.move.name) === normalize(name))).filter(Boolean);
      return matching.length >= 2;
    });
    if (explicit) {
      selected = explicit.slice(0, 2)
        .map((name) => moves.find((item) => normalize(item.move.name) === normalize(name)))
        .filter(Boolean);
      source = "guide";
    }

    if (selected.length < 2) {
      let best = null;
      for (let i = 0; i < moves.length; i += 1) {
        for (let j = i + 1; j < moves.length; j += 1) {
          const pair = [moves[i], moves[j]];
          const synergy = fusionPairScore(pair[0].move, pair[1].move);
          const orderBonus = (MAX_MOVE_SLOTS - pair[0].index + MAX_MOVE_SLOTS - pair[1].index) * 3;
          const score = synergy.score + orderBonus;
          if (!best || score > best.score) best = { pair, score };
        }
      }
      selected = best?.pair || moves.slice(0, 2);
    }

    const remaining = moves.filter((item) => !selected.some((chosen) => normalize(chosen.move.name) === normalize(item.move.name)));
    while (selected.length < moves.length && remaining.length) {
      const currentScore = fusionGroupScore(selected.map((item) => item.move)).score;
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const item = remaining[index];
        const expandedScore = fusionGroupScore([...selected.map((chosen) => chosen.move), item.move]).score;
        const sourceOrderBonus = Math.max(0, MAX_MOVE_SLOTS - item.index) * 2;
        const candidateScore = expandedScore - currentScore + sourceOrderBonus;
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestIndex = index;
        }
      }
      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    const names = selected.map((item) => item.move.name);
    const groupScore = fusionGroupScore(selected.map((item) => item.move));
    return {
      names,
      firstPair: names.slice(0, 2),
      additions: names.slice(2),
      source,
      score: groupScore.score,
      reasons: groupScore.reasons
    };
  }

  function getPartnerBuildBondPair() {
    const plan = getPartnerBuildBondPlan();
    return plan ? { ...plan, names: plan.firstPair } : null;
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
    const promptGroup = new Set(bondPromptMoveNames().map(normalize));
    return bondCardNodes().map((card) => {
      const candidate = candidateFromCard(card);
      let names = candidateMoveNames(candidate);
      if (bondPhase() === "second" && promptGroup.size) {
        // Bond option descriptions repeat the move/group named in the prompt,
        // e.g. “Hyper Voice … fires with Shadow Ball + Hex”. On this screen the
        // card itself is one loose move; ignore those descriptive references.
        const additions = names.filter((name) => !promptGroup.has(normalize(name)));
        if (additions.length) names = [additions[0]];
      }
      const moves = names.map(getMoveData).filter(Boolean);
      return { ...candidate, move: moves[0] || null, moves };
    }).filter((candidate) => candidate.move);
  }

  function candidateMoveNames(candidate) {
    const moves = Array.isArray(candidate?.moves) && candidate.moves.length
      ? candidate.moves
      : candidate?.move ? [candidate.move] : [];
    return moves.map((move) => move.name).filter((name, index, list) =>
      name && list.findIndex((item) => normalize(item) === normalize(name)) === index
    );
  }

  function bondPromptMoveNames() {
    const prompt = normalize(document.querySelector("#bond-sub")?.textContent || "");
    if (!prompt || !moveData.length) return [];
    const matches = moveData
      .map((move) => ({ move, name: normalize(move.name), at: prompt.indexOf(normalize(move.name)) }))
      .filter((item) => item.name && item.at >= 0)
      .sort((a, b) => a.at - b.at || b.name.length - a.name.length);
    const names = [];
    const occupied = [];
    for (const item of matches) {
      const end = item.at + item.name.length;
      if (occupied.some(([start, stop]) => item.at < stop && end > start)) continue;
      occupied.push([item.at, end]);
      names.push(item.move.name);
    }
    return names;
  }

  function sameMoveGroup(left, right) {
    const a = left.map(normalize).sort();
    const b = right.map(normalize).sort();
    return a.length === b.length && a.every((name, index) => name === b[index]);
  }

  function bondCandidateForName(candidates, name) {
    return candidates.find((candidate) => candidateMoveNames(candidate).length === 1
      && normalize(candidate.move?.name) === normalize(name))
      || candidates.find((candidate) => candidateMoveNames(candidate).some((item) => normalize(item) === normalize(name)));
  }

  function bondPhase() {
    const prompt = normalize(document.querySelector("#bond-sub")?.textContent || "");
    if (/\b(second|2nd|another)\b/.test(prompt)
      || /\bwhich move joins\b/.test(prompt)
      || /\bwhich move do you bond\b/.test(prompt)
      || /\bchoose which move\b/.test(prompt)
      || /\bmove joins\b/.test(prompt)
      || /que movimiento.*(se une|unir|vincul)/.test(prompt)) return "second";
    const backButton = document.querySelector("#bond-back");
    if (backButton && !backButton.classList.contains("hidden") && getComputedStyle(backButton).display !== "none") return "second";
    if (/\b(first|1st)\b/.test(prompt) || /primer movimiento/.test(prompt)) return "first";
    return "unknown";
  }

  function bondScreenVisible() {
    const screen = document.querySelector("#scr-bond");
    return Boolean(screen && !screen.classList.contains("hidden") && getComputedStyle(screen).display !== "none");
  }

  function bondPriority(name) {
    const index = activeBuildMoves().findIndex((move) => normalize(move.name) === normalize(name));
    return index < 0 ? 0 : Math.max(1, MAX_MOVE_SLOTS - index) * 3;
  }

  function chooseBondPlan(candidates) {
    const plan = getPartnerBuildBondPlan();
    const openGroups = state.fusedGroups.filter((group) => group.length >= 2 && group.length < MAX_BOND_GROUP_SIZE);
    const groupedCandidates = candidates
      .filter((candidate) => candidateMoveNames(candidate).length >= 2)
      .map((candidate) => {
        const names = candidateMoveNames(candidate);
        const tracked = openGroups.find((group) => sameMoveGroup(group, names));
        const plannedCount = names.filter((name) => plan?.names.some((item) => normalize(item) === normalize(name))).length;
        const synergy = fusionGroupScore(names.map(getMoveData).filter(Boolean));
        return { candidate, names, tracked, score: (tracked ? 1000 : 0) + plannedCount * 20 + synergy.score };
      })
      .filter((item) => item.names.length < MAX_BOND_GROUP_SIZE)
      .sort((a, b) => b.score - a.score);
    if (groupedCandidates.length) {
      const bestGroup = groupedCandidates[0];
      return { candidate: bestGroup.candidate, names: bestGroup.names, source: bestGroup.tracked ? "run" : plan?.source || "moveset" };
    }

    // A pending group must be extended before the game can start another pair.
    // If its card was not recognized, wait instead of suggesting an illegal pair.
    if (openGroups.length) return null;

    const preferredPair = plan?.firstPair || getPartnerBuildBondPair()?.names || [];
    const preferredFirst = preferredPair.find((name) => {
      const candidate = bondCandidateForName(candidates, name);
      return candidate && candidateMoveNames(candidate).length === 1;
    });
    if (preferredFirst) {
      const second = preferredPair.find((name) => normalize(name) !== normalize(preferredFirst));
      return {
        candidate: bondCandidateForName(candidates, preferredFirst),
        names: [preferredFirst, second].filter(Boolean),
        source: plan?.source || "moveset"
      };
    }

    let best = null;
    for (let i = 0; i < candidates.length; i += 1) {
      if (candidateMoveNames(candidates[i]).length !== 1) continue;
      for (let j = i + 1; j < candidates.length; j += 1) {
        if (candidateMoveNames(candidates[j]).length !== 1) continue;
        const first = candidateMoveNames(candidates[i]);
        const second = candidateMoveNames(candidates[j]);
        if (!first.length || !second.length || first.some((name) => second.some((item) => normalize(item) === normalize(name)))) continue;
        const names = [...first, ...second];
        if (names.length > MAX_BOND_GROUP_SIZE) continue;
        const score = fusionGroupScore(names.map(getMoveData).filter(Boolean)).score
          + names.reduce((sum, name) => sum + bondPriority(name), 0);
        if (!best || score > best.score) best = { candidate: candidates[i], names, source: "moveset", score };
      }
    }
    return best;
  }

  function chooseBondPartner(firstNames, candidates) {
    const selectedNames = Array.isArray(firstNames) ? firstNames : [firstNames];
    const normalizedFirst = new Set(selectedNames.map(normalize));
    const plan = getPartnerBuildBondPlan();
    const plannedNextMoves = (plan?.names || []).filter((name) => !normalizedFirst.has(normalize(name)));
    const availableSingles = candidates
      .map((candidate) => ({ candidate, names: candidateMoveNames(candidate) }))
      .filter(({ names }) => names.length === 1 && !normalizedFirst.has(normalize(names[0])));

    // Honor the build sequence exactly when a planned move is on the current
    // Bond screen. If it is not offered, try the next planned move in order.
    for (const plannedName of plannedNextMoves) {
      const planned = availableSingles.find(({ names }) => normalize(names[0]) === normalize(plannedName));
      if (planned) return planned.candidate;
    }

    // No planned move is available: choose the strongest legal option among
    // the cards the game actually shows. A single offered card is still valid.
    if (!availableSingles.length) return null;
    const baseScore = fusionGroupScore(selectedNames.map(getMoveData).filter(Boolean)).score;
    const explicitPairs = configuredBuildForCurrentPokemon()
      ? [getPartnerBuildBondPlan()?.names || []]
      : state.partnerBuild?.bondGroups || [];
    const ranked = availableSingles
      .map(({ candidate, names }) => {
        const mergedNames = [...selectedNames, ...names];
        if (mergedNames.length > MAX_BOND_GROUP_SIZE) return null;
        const groupScore = fusionGroupScore(mergedNames.map(getMoveData).filter(Boolean)).score;
        const priority = names.reduce((sum, name) => sum + bondPriority(name), 0);
        const explicitBonus = explicitPairs.some((group) =>
          selectedNames.some((name) => group.some((item) => normalize(item) === normalize(name)))
          && names.some((name) => group.some((item) => normalize(item) === normalize(name)))
        ) ? 60 : 0;
        return { candidate, names, score: groupScore - baseScore + priority + explicitBonus };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.candidate || null;
  }

  function bondSelectionSignature(phase, candidates) {
    return `${phase}|${candidates.map((candidate) => candidateMoveNames(candidate).map(normalize).join("+")).join(",")}`;
  }

  function formatBondNames(names) {
    return names.join(" + ");
  }

  function updateBondState() {
    const visible = bondScreenVisible();
    if (!visible) {
      if (isBondVisible) {
        if (bondPendingFirstGroup.length && bondPendingSecondGroup.length) {
          const fusedNames = [...bondPendingFirstGroup, ...bondPendingSecondGroup];
          markMovesFused(fusedNames);
          ui.bondStatus.textContent = `Đã ghi nhận Bond: ${formatBondNames(bondPendingFirstGroup)} + ${formatBondNames(bondPendingSecondGroup)}.`;
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
    if (phase === "second") {
      // The current game often opens directly on the second choice and names
      // the selected move or whole group in the prompt. Recover it from there
      // when this content script did not observe the earlier click.
      const promptGroup = bondPromptMoveNames();
      if (promptGroup.length) {
        bondPendingFirstGroup = promptGroup;
        bondPendingFirstMove = formatBondNames(promptGroup);
      }
      // A manual first choice should still allow Auto Bond to select the
      // remaining move after the prompt advances. A manual second choice stays manual.
      if (bondManualOverride && bondPendingFirstGroup.length && !bondPendingSecondGroup.length) {
        bondManualOverride = false;
      }
    }
    if (phase === "second" && bondWatchdogTimer) {
      clearTimeout(bondWatchdogTimer);
      bondWatchdogTimer = null;
    }
    if (bondPendingSecondMove || bondManualOverride) return;
    if (!state.autoBondFromMoveset || !hasAutoBuildPlan()) {
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
      const candidate = plan?.candidate;
      if (!candidate) {
        ui.bondStatus.textContent = "Chưa tìm được thẻ hoặc nhóm move phù hợp để bắt đầu Bond.";
        return;
      }
      const signature = bondSelectionSignature(phase, candidates);
      queueBondChoice(candidate, phase, signature, plan?.source === "guide" || plan?.source === "user"
        ? `theo thứ tự build: ${formatBondNames(plan.names)}`
        : `theo lộ trình Bond: ${formatBondNames(plan?.names || candidateMoveNames(candidate))}`);
      return;
    }

    if (!bondPendingFirstGroup.length) {
      const selected = bondCardNodes().find((node) => node.matches('[aria-selected="true"], [aria-pressed="true"], .selected, .is-selected, .chosen'));
      const promptGroup = bondPromptMoveNames();
      const inferred = promptGroup.length ? promptGroup : selected ? candidateMoveNames(candidateFromCard(selected)) : [];
      if (inferred.length) {
        bondPendingFirstGroup = inferred;
        bondPendingFirstMove = formatBondNames(inferred);
      }
    }
    if (!bondPendingFirstGroup.length) {
      ui.bondStatus.textContent = "Chưa nhận diện move thứ nhất; sẽ không tự chọn ngẫu nhiên move thứ hai.";
      return;
    }
    const candidate = chooseBondPartner(bondPendingFirstGroup, candidates);
    if (!candidate) {
      const plannedNext = getPartnerBuildBondPlan()?.names.find((name) => !bondPendingFirstGroup.some((item) => normalize(item) === normalize(name)));
      ui.bondStatus.textContent = plannedNext
        ? `Chưa nhận diện được move hợp lệ trên màn Bond; move ưu tiên ${plannedNext} hiện không có trong lựa chọn.`
        : `Chưa nhận diện được move lẻ hợp lệ để ghép với ${bondPendingFirstMove}.`;
      return;
    }
    const signature = bondSelectionSignature(phase, candidates);
    const selectedNames = candidateMoveNames(candidate);
    const plannedNext = getPartnerBuildBondPlan()?.names.find((name) => !bondPendingFirstGroup.some((item) => normalize(item) === normalize(name)));
    const followsBuild = plannedNext && selectedNames.some((name) => normalize(name) === normalize(plannedNext));
    queueBondChoice(candidate, phase, signature, followsBuild
      ? `ưu tiên ${plannedNext} trong build; ghép với ${bondPendingFirstMove}`
      : `phương án dự phòng tốt nhất đang hiện; ghép với ${bondPendingFirstMove}`);
  }

  function queueBondChoice(candidate, phase, signature, reason) {
    if (bondAutoTimer || bondAttemptSignature === signature) return;
    bondAttemptSignature = signature;
    const candidateNames = candidateMoveNames(candidate);
    const candidateLabel = formatBondNames(candidateNames);
    ui.bondStatus.textContent = `Sẽ tự chọn ${candidateLabel} (${reason})…`;
    const queuedAt = Date.now();
    const attemptChoice = () => {
      bondAutoTimer = null;
      const currentPhase = bondPhase();
      const currentCandidates = bondCandidates();
      const current = currentCandidates.find((item) => item.element === candidate.element)
        || currentCandidates.find((item) => sameMoveGroup(candidateMoveNames(item), candidateNames));
      if (!state.autoBondFromMoveset || !bondScreenVisible() || currentPhase !== phase || !current?.element.isConnected || bondManualOverride) {
        bondAttemptSignature = "";
        updateBondState();
        return;
      }
      const cardList = document.querySelector("#bond-cards");
      const cardLocked = cardList?.classList.contains("guard")
        || current.element.matches(":disabled, [aria-disabled='true']");
      if (cardLocked) {
        if (Date.now() - queuedAt >= AUTO_BOND_READY_TIMEOUT_MS) {
          bondAttemptSignature = "";
          ui.bondStatus.textContent = `Game vẫn đang khóa thẻ ${candidateLabel}; hãy chọn thủ công.`;
          return;
        }
        ui.bondStatus.textContent = "Game đang khóa thẻ Bond trong chốc lát; extension chờ thẻ mở rồi mới chọn.";
        bondAutoTimer = setTimeout(attemptChoice, AUTO_BOND_READY_POLL_MS);
        return;
      }
      if (phase === "first") {
        bondPendingFirstGroup = candidateMoveNames(current);
        bondPendingFirstMove = formatBondNames(bondPendingFirstGroup);
        bondPendingSecondMove = "";
        bondPendingSecondGroup = [];
      } else {
        bondPendingSecondGroup = candidateMoveNames(current);
        bondPendingSecondMove = formatBondNames(bondPendingSecondGroup);
      }
      bondPendingStartedAt = Date.now();
      current.element.click();
      ui.bondStatus.textContent = `Đã click ${formatBondNames(candidateMoveNames(current))}; đang chờ game xác nhận bước Bond.`;
      if (bondWatchdogTimer) clearTimeout(bondWatchdogTimer);
      bondWatchdogTimer = setTimeout(() => {
        bondWatchdogTimer = null;
        if (!bondScreenVisible()) return;
        const stillSamePhase = bondPhase() === phase;
        if (stillSamePhase && phase === "first" && sameMoveGroup(bondPendingFirstGroup, candidateMoveNames(current))) {
          bondPendingFirstMove = "";
          bondPendingFirstGroup = [];
          bondAttemptSignature = "";
          ui.bondStatus.textContent = `Game chưa chuyển bước sau khi click ${candidateLabel}; hãy chọn thủ công.`;
        } else if (stillSamePhase && phase === "second" && sameMoveGroup(bondPendingSecondGroup, candidateMoveNames(current))) {
          bondPendingSecondMove = "";
          bondPendingSecondGroup = [];
          bondAttemptSignature = "";
          ui.bondStatus.textContent = `Game chưa xác nhận ${candidateLabel}; hãy chọn thủ công.`;
        }
      }, 1800);
    };
    bondAutoTimer = setTimeout(attemptChoice, AUTO_BOND_DELAY_MS);
  }

  function recordManualBondChoice(candidate) {
    if (!candidate?.move) return;
    const names = candidateMoveNames(candidate);
    const label = formatBondNames(names);
    const phase = bondPhase();
    if (phase === "second") {
      const promptGroup = bondPromptMoveNames();
      if (promptGroup.length) {
        bondPendingFirstGroup = promptGroup;
        bondPendingFirstMove = formatBondNames(promptGroup);
      }
    }
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    bondAutoTimer = null;
    bondAttemptSignature = "";
    bondManualOverride = true;
    if (phase === "first" || !bondPendingFirstMove) {
      bondPendingFirstGroup = names;
      bondPendingFirstMove = label;
      bondPendingSecondMove = "";
      bondPendingSecondGroup = [];
      ui.bondStatus.textContent = `Đã nhận move thứ nhất: ${label}.`;
    } else {
      bondPendingSecondGroup = names;
      bondPendingSecondMove = label;
      ui.bondStatus.textContent = `Đã nhận cặp ${bondPendingFirstMove} + ${label}; chờ game xác nhận.`;
    }
  }

  function onGameBondCardClick(event) {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest("#bond-cards .card") || target?.closest('#bond-cards button, #bond-cards [role="button"]') || target?.closest("#bond-cards > *");
    if (card) recordManualBondChoice(bondCandidates().find((candidate) => candidate.element === card) || candidateFromCard(card));
  }

  function clearBondTracking() {
    if (bondAutoTimer) clearTimeout(bondAutoTimer);
    if (bondWatchdogTimer) clearTimeout(bondWatchdogTimer);
    bondAutoTimer = null;
    bondWatchdogTimer = null;
    bondAttemptSignature = "";
    bondPendingFirstMove = "";
    bondPendingSecondMove = "";
    bondPendingFirstGroup = [];
    bondPendingSecondGroup = [];
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

    const actualBondGroups = state.fusedGroups
      .map((group) => [...new Set(group.map((name) => getMoveData(name)?.name).filter(Boolean))])
      .filter((group) => group.length >= 2);
    const plannedBond = state.autoBondFromMoveset ? getPartnerBuildBondPlan() : null;
    const bondGroups = [...actualBondGroups];
    let bondProjected = false;
    if (plannedBond?.names?.length >= 2) {
      if (!bondGroups.length) {
        bondGroups.push(plannedBond.names);
        bondProjected = true;
      } else {
        const matchingGroup = bondGroups.findIndex((group) => group.some((name) =>
          plannedBond.names.some((planned) => normalize(planned) === normalize(name))
        ));
        if (matchingGroup >= 0) {
          const current = bondGroups[matchingGroup];
          const projected = [...new Set([...plannedBond.names, ...current].map((name) => getMoveData(name)?.name || name))]
            .slice(0, MAX_BOND_GROUP_SIZE);
          if (projected.length > current.length) {
            bondGroups[matchingGroup] = projected;
            bondProjected = true;
          }
        }
      }
    }

    for (const learned of state.learnedMoves) appendMove(learned.name, Number(learned.level) || 1);
    if (!entries.length || (state.autoBuildFromMoveset && hasAutoBuildPlan())) {
      for (const planned of activeBuildMoves()) appendMove(planned.name, 1);
    }
    for (const group of actualBondGroups) {
      for (const name of group) appendMove(name, 1);
    }
    if (plannedBond) {
      for (const name of plannedBond.names) appendMove(name, 1);
    }

    const profiles = entries.map(({ move, level }) => ({
      move,
      level,
      profile: moveProfile(move),
      rapid: /several times|multiple times|many times|repeatedly|rapidly|spin in place|hits everything/.test(normalize(move.description))
    }));
    const attacks = profiles.filter((entry) => !entry.profile.isBuff && !entry.profile.control);
    const groupedNames = new Set(bondGroups.flat().map(normalize));
    const bondProfiles = bondGroups.map((group) => ({
      names: group,
      profiles: group.map((name) => profiles.find((entry) => normalize(entry.move.name) === normalize(name))).filter(Boolean)
    }));
    const bondDamageProfiles = bondProfiles.flatMap((group) => group.profiles.filter((entry) => !entry.profile.isBuff));
    const bondAttackSlotCount = bondProfiles.filter((group) => group.profiles.some((entry) => !entry.profile.isBuff)).length;
    const looseAttackSlotCount = attacks.filter((entry) => !groupedNames.has(normalize(entry.move.name))).length;
    const bondHasHexTrigger = bondProfiles.some((group) =>
      group.profiles.some((entry) => normalize(entry.move.name) === "hex")
      && group.profiles.some((entry) => normalize(entry.move.name) !== "hex"
        && entry.profile.statuses.some((status) => ["burn", "poison", "slow"].includes(status)))
    );
    const hasActualBond = actualBondGroups.length > 0;
    const bondNames = [...new Set(bondGroups.flat())];

    return {
      source: state.learnedMoves.length ? "skill đã học" : hasAutoBuildPlan() ? "move set Partner" : "hướng build",
      moves: profiles,
      attacks,
      areaAttacks: attacks.filter((entry) => entry.profile.area).length,
      rapidAttacks: profiles.filter((entry) => entry.rapid).length,
      hasSustain: profiles.some((entry) => entry.profile.sustain),
      topLevel: Math.max(0, ...profiles.map((entry) => entry.level)),
      armorPicks: state.statPicks.filter((item) => ["armor", "vigor", "synthesis"].includes(normalize(item))).length,
      sprintPicks: state.statPicks.filter((item) => normalize(item) === "sprint").length,
      attackSlotCount: bondAttackSlotCount + looseAttackSlotCount,
      bondAttackSlotCount,
      bondDamageCount: bondDamageProfiles.length,
      bondRapidCount: bondDamageProfiles.filter((entry) => entry.rapid).length,
      bondHasHexTrigger,
      hasActualBond,
      bondProjected,
      bondConfidence: hasActualBond ? bondProjected ? 0.75 : 1 : plannedBond ? 0.45 : 0,
      bondContextLabel: bondNames.length
        ? `${hasActualBond ? bondProjected ? "Bond hiện tại + build dự kiến" : "Bond đang dùng" : "Bond dự kiến"}: ${bondNames.join(" + ")}`
        : ""
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
    const attackSlotCount = Number.isFinite(facts.attackSlotCount) ? facts.attackSlotCount : attackCount;
    const bondConfidence = Number(facts.bondConfidence) || 0;
    const bondSourceLabel = facts.hasActualBond
      ? facts.bondProjected ? "Bond hiện tại + build dự kiến" : "Bond hiện tại"
      : "Bond dự kiến";
    const strategyIsSurvival = state.strategy === "survival";
    switch (item.id) {
      case "quick-claw":
        add(15 + Math.min(6, attackCount * 2), "giảm hồi chiêu cho toàn bộ move đang dùng");
        if (facts.rapidAttacks) add(Math.min(4, facts.rapidAttacks * 2), "hợp build có đòn đánh lặp/đánh nhiều lần");
        if (facts.bondDamageCount >= 2) {
          const bonus = Math.round(Math.min(9, (facts.bondDamageCount - 1) * 3) * bondConfidence);
          add(bonus, `${bondSourceLabel} gom ${facts.bondDamageCount} đòn; giảm hồi chiêu hỗ trợ nhóm cùng kích hoạt`);
        }
        if (facts.bondHasHexTrigger) add(Math.round(4 * bondConfidence), "giảm hồi chiêu giúp nhóm Hex và move gây trạng thái có thêm lượt phối hợp");
        break;
      case "lucky-egg":
        add(12, "tăng EXP để lên cấp và hoàn thiện build sớm hơn");
        if (state.lastLevel < 12) add(5, "run còn ở giai đoạn đầu");
        else if (state.lastLevel > 30) add(-3, "run đã ở giai đoạn muộn");
        break;
      case "shell-bell":
        add(7 + Math.min(10, attackCount * 2), "hồi phục dựa trên sát thương gây ra");
        if (facts.bondDamageCount >= 2) {
          const bonus = Math.round(Math.min(8, (facts.bondDamageCount - 1) * 3) * bondConfidence);
          add(bonus, `${bondSourceLabel} dồn ${facts.bondDamageCount} đòn; Shell Bell hồi theo damage của nhóm`);
        }
        if (facts.rapidAttacks) add(Math.min(6, facts.rapidAttacks * 3), "hợp move đánh nhiều lần");
        if (facts.hasSustain) add(2, "cộng thêm khả năng trụ lâu cho build có hồi phục");
        break;
      case "choice-band":
        add(11, "tăng sát thương mạnh cho build tập trung tấn công");
        if (attackSlotCount === 0) add(-10, "move set chưa có đòn gây sát thương để tận dụng Choice Band");
        else if (attackSlotCount === 1) add(12, "build tập trung vào một ô tấn công chủ lực");
        else if (attackSlotCount === 2) add(4, "build chỉ có hai ô tấn công để luân phiên");
        else add(-8, "nhiều ô tấn công riêng sẽ bị hạn chế đổi move");
        if (facts.bondDamageCount >= 2 && facts.bondAttackSlotCount === 1) {
          const bonus = Math.round(6 * bondConfidence);
          add(bonus, `${bondSourceLabel} gom nhiều đòn vào một ô, giảm nhu cầu đổi move`);
        }
        if (facts.topLevel >= 3) add(3, "đòn chủ lực đã được nâng cấp");
        break;
      case "life-orb":
        add(10 + Math.min(8, attackCount * 2), "tăng sát thương cho các move gây damage");
        if (facts.bondDamageCount >= 2) {
          const bonus = Math.round(5 * bondConfidence);
          add(bonus, `${bondSourceLabel} có ${facts.bondDamageCount} đòn cùng hưởng tăng sát thương`);
        }
        if (facts.rapidAttacks) add(Math.min(4, facts.rapidAttacks * 2), "hợp build có đòn đánh liên tục");
        if (strategyIsSurvival) add(-6, "đổi một phần khả năng trụ lâu lấy sát thương");
        if (facts.hasSustain) add(4, "build hiện tại có hồi phục để bù hao HP");
        break;
      case "leftovers":
        add(11, "hồi HP liên tục trong cả lượt");
        if (facts.bondDamageCount >= 2 && !facts.hasSustain) {
          add(Math.round(3 * bondConfidence), `${bondSourceLabel} dồn sát thương; hồi HP liên tục giúp tăng độ an toàn`);
        }
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
    const buildSource = facts.bondContextLabel ? `${facts.source} · ${facts.bondContextLabel}` : facts.source;
    return { ...candidate, score: score.value, reasons: score.reasons, recognized: true, itemName: item.name, buildSource };
  }

  function itemCandidateSignature(candidates) {
    return candidates.map((candidate) => `${candidate.item?.id || "unknown"}:${candidate.action}:${candidate.normalizedText}`).join("||");
  }

  function renderItemRecommendations(ranked) {
    ui.itemRecommendations.replaceChildren();
    if (!ranked.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = isItemVisible ? "Đang chờ nội dung item để xếp hạng." : state.heldItem ? `Item hiện tại: ${state.heldItem}.` : "Khi item xuất hiện, extension sẽ xếp hạng theo Partner, move set và Bond.";
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
      ui.itemStatus.textContent = `${facts.bondContextLabel ? `Đang đối chiếu ${facts.bondContextLabel}. ` : ""}Tự chọn item đang tắt; extension vẫn xếp hạng để bạn chọn.`;
      return;
    }
    if (candidates.length < 2) {
      ui.itemStatus.textContent = `${facts.bondContextLabel ? `Đang đối chiếu ${facts.bondContextLabel}. ` : ""}Đang chờ đủ lựa chọn item để so sánh.`;
      return;
    }
    if (ranked.some((candidate) => !candidate.recognized)) {
      ui.itemStatus.textContent = `${facts.bondContextLabel ? `Đang đối chiếu ${facts.bondContextLabel}. ` : ""}Có item chưa nhận diện; extension tạm dừng tự chọn để tránh bấm nhầm.`;
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
    const merged = [...new Set([...involved.flat(), ...names].map((name) => moveData.find((move) => normalize(move.name) === normalize(name))?.name || name))];
    if (merged.length > MAX_BOND_GROUP_SIZE) {
      ui.autoStatus.textContent = "Một nhóm Bond tối đa 4 move.";
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
    const partnerPlan = getPartnerBuildBondPlan();
    if (partnerPlan) {
      const row = document.createElement("div");
      row.className = "recommendation best";
      const title = document.createElement("div");
      title.className = "recommendation-head";
      const names = document.createElement("strong");
      const firstPair = partnerPlan.firstPair.join(" + ");
      names.textContent = partnerPlan.names.length >= 4
        ? `Lộ trình Bond: ${firstPair} → thêm ${partnerPlan.additions.join(" → thêm ")}`
        : `Bond ưu tiên: ${partnerPlan.names.join(" + ")}`;
      const source = document.createElement("span");
      source.className = "score";
      source.textContent = partnerPlan.source === "user" ? "bạn chọn" : partnerPlan.source === "guide" ? "build" : "gợi ý";
      title.append(names, source);
      const reason = document.createElement("p");
      const learned = new Set(state.learnedMoves.map((move) => normalize(move.name)));
      const learnedCount = partnerPlan.names.filter((name) => learned.has(normalize(name))).length;
      const reasonText = partnerPlan.reasons.slice(0, 2).join(" · ");
      reason.textContent = partnerPlan.source === "user"
        ? `Theo move set và cặp Bond đầu tiên bạn xác nhận; các Bond sau thêm move theo thứ tự đã đặt. Đã có ${learnedCount}/${partnerPlan.names.length} move trong lượt.${reasonText ? ` ${reasonText}.` : ""}`
        : partnerPlan.source === "guide"
        ? `Ghép cặp mở đầu, rồi mỗi Bond thêm một move vào nhóm đang mở; đã có ${learnedCount}/${partnerPlan.names.length} move trong lượt.${reasonText ? ` ${reasonText}.` : ""}`
        : `Xếp theo tương tác giữa sát thương, khống chế, trạng thái và thứ tự build; mỗi Bond sau thêm một move vào nhóm; đã có ${learnedCount}/${partnerPlan.names.length}.${reasonText ? ` ${reasonText}.` : ""}`;
      row.append(title, reason);
      ui.fusions.append(row);
    }
    if (moves.length < 2) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = partnerPlan ? "Học thêm move trong lượt để xem thứ tự ghép hiện tại." : "Học thêm skill để xem các cặp kết hợp.";
      ui.fusions.append(message);
      return;
    }
    const groupedNames = new Set(state.fusedGroups.flat().map(normalize));
    const loose = moves.filter((move) => !groupedNames.has(normalize(move.name)));
    const growingGroup = state.fusedGroups.find((group) => group.length > 1 && group.length < MAX_BOND_GROUP_SIZE);
    const options = [];
    const addOption = (names, label) => {
      const uniqueNames = [...new Set(names)];
      const uniqueKey = uniqueNames.map(normalize).sort().join("|");
      if (uniqueNames.length < 2 || uniqueNames.length > MAX_BOND_GROUP_SIZE
        || options.some((option) => option.key === uniqueKey)) return;
      const result = fusionGroupScore(uniqueNames.map(getMoveData).filter(Boolean));
      options.push({ key: uniqueKey, names: uniqueNames, label, ...result });
    };
    if (growingGroup) {
      for (const add of loose) {
        addOption([...growingGroup, add.name], `${growingGroup.join(" + ")} + ${add.name}`);
      }
    } else {
      for (let i = 0; i < loose.length; i += 1) {
        for (let j = i + 1; j < loose.length; j += 1) {
          addOption([loose[i].name, loose[j].name], `${loose[i].name} + ${loose[j].name}`);
        }
      }
    }
    options.sort((a, b) => b.score - a.score);
    if (!options.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = state.fusedGroups.some((group) => group.length >= MAX_BOND_GROUP_SIZE) && !loose.length
        ? "Nhóm Bond đã đạt giới hạn 4 move."
        : growingGroup
          ? "Nhóm Bond đang mở; cần thêm một move lẻ để ghép tiếp."
          : loose.length < 2
            ? "Cần thêm move chưa ghép để dùng Bond tiếp theo."
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
      names.textContent = option.label;
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
      mark.addEventListener("click", () => markMovesFused(option.names));
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
      level.textContent = move.origin === "starting"
        ? `Mở màn · Lv ${move.level || 1}/5`
        : move.evolved ? "Đã tiến hóa" : `Lv ${move.level || 1}/5`;
      if (move.origin === "starting") {
        level.title = move.startSource === "saved"
          ? "Move mở màn lấy từ cài đặt Partner đã lưu trong game."
          : "Move mở màn mặc định theo loài Pokémon trong game.";
      }
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
    .panel.build-mode { top: 50%; right: auto; left: 50%; width: min(820px, calc(100vw - 24px)); height: min(86vh, 780px); max-height: 92vh; transform: translate(-50%, -50%); }
    .panel.build-mode > .header, .panel.build-mode > .body { display: none !important; }
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
    .primary-button { width: 100%; min-height: 34px; margin: 5px 0; padding: 6px 9px; border: 1px solid #d4ad59; border-radius: 8px; background: linear-gradient(180deg, #3b5687, #283d66); color: #fff0c7; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }
    .primary-button:disabled { opacity: .5; cursor: not-allowed; }
    .build-screen[hidden] { display: none !important; }
    .build-screen { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; overflow: hidden; }
    .build-screen-header { display: grid; grid-template-columns: 92px minmax(0, 1fr) 34px; align-items: center; gap: 12px; min-height: 68px; padding: 10px 16px; border-bottom: 1px solid #394760; background: linear-gradient(120deg, #1d2a40, #172031); }
    .build-screen-heading { min-width: 0; }
    .build-screen-heading strong { display: block; font-size: 17px; line-height: 1.25; }
    .build-screen-heading small { display: block; margin-top: 3px; color: #9fb1cc; font-size: 11px; }
    .build-screen-header .eyebrow { margin: 0 0 2px; }
    .build-back { min-height: 34px; white-space: nowrap; }
    .build-config { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; gap: 10px; overflow: hidden; margin: 0; padding: 12px 14px; background: #101827; }
    .build-config-intro { display: grid; gap: 8px; flex: 0 0 auto; }
    .build-config-intro > .muted { margin: 0; font-size: 11px; line-height: 1.45; }
    .build-config-summary { overflow-wrap: anywhere; color: #f5d995; font-size: 11px; font-weight: 750; line-height: 1.35; }
    .build-config-moves { display: grid; flex: 1 1 auto; min-height: 0; gap: 7px; overflow-y: auto; padding: 2px 5px 2px 0; scrollbar-gutter: stable; }
    .build-config-move { display: grid; grid-template-columns: 42px minmax(0, 1fr) 92px 44px; align-items: center; gap: 10px; min-height: 82px; padding: 9px 10px; border: 1px solid #344662; border-radius: 10px; background: #17253c; }
    .build-config-move.selected { border-color: #ad8d50; background: #222b36; }
    .move-icon { width: 32px; height: 32px; flex: 0 0 auto; image-rendering: pixelated; }
    .build-config-move .move-icon { width: 40px; height: 40px; }
    .build-config-details { display: grid; gap: 2px; min-width: 0; }
    .build-config-details strong { overflow-wrap: anywhere; font-size: 13px; line-height: 1.2; }
    .build-config-details small { color: #98a9c3; font-size: 10px; line-height: 1.25; }
    .build-config-details .build-config-description { overflow-wrap: anywhere; color: #d1dced; font-size: 11px; line-height: 1.35; }
    .build-config-controls { display: grid; gap: 3px; }
    label.config-choice { display: flex; justify-content: flex-start; gap: 5px; margin: 0; color: #bccbe0; font-size: 10px; line-height: 1.2; cursor: pointer; }
    label.config-choice input { width: 14px; height: 14px; flex: 0 0 14px; margin: 0; padding: 0; accent-color: #f5c76b; }
    label.bond-choice { color: #f2cb76; }
    .build-config-order { display: grid; gap: 3px; }
    .order-button { width: 24px; height: 22px; padding: 0; line-height: 1; }
    .build-config-bond { padding: 8px 10px; border-radius: 8px; background: #2b291f; color: #f4d48a; font-size: 11px; font-weight: 700; line-height: 1.4; }
    .build-config-footer { flex: 0 0 auto; padding-top: 8px; border-top: 1px solid #344662; }
    .build-config-footer .auto-status { margin: 0 0 7px; font-size: 11px; }
    .build-config-actions { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; }
    .build-config-actions .quiet-button { min-height: 38px; padding: 0 8px; font-size: 11px; }
    .build-config-actions .primary-button { min-height: 38px; margin: 0; font-size: 11px; }
    @media (max-width: 560px) {
      .panel.build-mode { width: calc(100vw - 16px); height: 92vh; max-height: 94vh; }
      .build-screen-header { grid-template-columns: 76px minmax(0, 1fr) 32px; gap: 7px; padding: 8px; }
      .build-screen-heading strong { font-size: 14px; }
      .build-screen-heading small { font-size: 9px; }
      .build-config { padding: 9px 8px; }
      .build-config-move { grid-template-columns: 34px minmax(0, 1fr) 76px 34px; gap: 6px; min-height: 76px; padding: 7px; }
      .build-config-move .move-icon { width: 32px; height: 32px; }
      .build-config-details strong { font-size: 11px; }
      .build-config-details small { font-size: 9px; }
      .build-config-details .build-config-description { font-size: 10px; }
      label.config-choice { font-size: 9px; }
      .build-config-actions { grid-template-columns: 68px minmax(0, 1fr); gap: 5px; }
      .build-config-actions .primary-button { font-size: 9px; }
    }
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
    .build-item { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 5px 7px; background: #172235; border-radius: 7px; font-size: 11px; }
    .moveset-item span:not(.build-level) { min-width: 0; flex: 1; overflow-wrap: anywhere; }
    .moveset-source { margin: 0; line-height: 1.35; }
    .selected-build-summary { padding: 6px 7px; border: 1px solid #846b3e; border-radius: 7px; background: #25251f; color: #eed28b; font-size: 10px; }
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
