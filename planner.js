const DATA_FILES = { weapons: "data/weapons.json", attachments: "data/attachments.json", skills: "data/skills.json", perks: "data/perks.json", heists: "data/heists.json", equipment: "data/equipment.json", gadgets: "data/gadgets.json", melee: "data/melees.json", throwables: "data/throwables.json", armors: "data/armors.json", tierList: "data/tier-list.json" };
const GAME_DATA_FILE = "game-data/game_data.json";
const PLAYER_DATA_FILE = "game-data/player_data.json";
const STAT_NAMES = { armor: "Armor", health: "Health", concealment: "Concealment", speed: "Speed", dodge: "Dodge", steadiness: "Steadiness", stamina: "Stamina", critChance: "Crit chance", damage: "Damage", accuracy: "Accuracy", stability: "Stability", threat: "Threat", ammo: "Ammo", rpm: "RPM", magSize: "Magazine" };
const BUILD_STATS = ["armor", "health", "concealment", "speed", "dodge", "steadiness", "stamina", "critChance", "damage", "accuracy", "stability", "threat", "ammo"];
const DEFAULT_BUILD = { selectedPrimary: "game:amcar", selectedSecondary: "game:deagle", selectedWeaponSlot: "primary", selectedAttachments: {}, selectedSkillIds: ["ghost-shinobi", "enforcer-tank"], selectedGameSkills: {}, selectedGameTreeId: "1", selectedTree: "ghost", selectedBranch: "all", selectedPerk: "crew-chief", selectedEquipment: { gadgets: ["ammo-bag", null], melee: "utility-knife", throwables: "throwing-knife", armor: "two-piece-suit" }, selectedHeist: "shadow-raid", optimizerStyle: "stealth", optimizerPurpose: "overall", weaponCategory: "all", notice: "" };
const state = { data: null, gameData: null, playerData: null, currentProfileId: null, gameSkillQuery: "", selectedGadgetSlot: 0, gearCategories: {}, ...DEFAULT_BUILD };
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[char]));
function normalizeGameData(gameData, data) {
	const rawParts = gameData.weapon_parts || {};
	const partMap = new Map();
	const rawWeapons = Object.entries(gameData.weapons || {}).map(([gameId, raw]) => {
		const factoryEntry = Object.entries(gameData.weapon_factory || {}).find(([factoryId]) => factoryId.endsWith(`_${gameId}`));
		const factory = factoryEntry?.[1];
		const compatibleAttachmentIds = [];
		const validTypes = new Set(Object.values(factory?.optional_types || {}));
		Object.values(factory?.uses_parts || {}).forEach((partId) => {
			const part = rawParts[partId];
			if (!part || !part.type || (validTypes.size && !validTypes.has(part.type))) return;
			const attachmentId = `game-part:${partId}`;
			compatibleAttachmentIds.push(attachmentId);
			if (!partMap.has(attachmentId)) {
				const statModifiers = Object.fromEntries(Object.entries(part.stats || {}).filter(([key, value]) => BUILD_STATS.includes(key) && Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]));
				partMap.set(attachmentId, { id: attachmentId, gamePartId: partId, name: part.name || part.name_id || partId, category: part.type, slot: part.type, statModifiers, gameStats: part.stats || {}, compatibleWeaponIds: [], dataStatus: "raw game data" });
			}
			partMap.get(attachmentId).compatibleWeaponIds.push(`game:${gameId}`);
		});
		const stats = raw.stats || {};
		const fireRate = Number(raw.fire_mode_data?.fire_rate);
		const baseStats = { damage: Number(stats.damage || 0), concealment: Number(stats.concealment || 0) };
		if (fireRate > 0) baseStats.rpm = Math.round(60 / fireRate);
		const slot = Number(raw.use_data?.selection_index) === 1 ? "secondary" : "primary";
		return { id: `game:${gameId}`, gameWeaponId: gameId, gameFactoryId: factoryEntry?.[0], name: raw.name || raw.name_id || gameId, category: (raw.category || ["weapon"])[0], type: slot, slot, slots: [slot], tags: raw.category || [], baseStats, rawStats: stats, attachmentSlots: [...new Set(compatibleAttachmentIds.map((id) => partMap.get(id)?.slot).filter(Boolean))], compatibleAttachmentIds, dataStatus: "raw game data" };
	});
	const rawPerks = (gameData.perk_decks || []).map((deck) => ({ id: `game-perk:${deck.id}`, gamePerkId: deck.id, name: deck.name || `Deck ${deck.id}`, playstyle: "Game catalog", summary: "Raw game data; effects require upgrade localization.", description: "Imported from game_data.json. Upgrade effects are not calculated.", cards: (deck.cards || []).map((card, index) => ({ order: index + 1, name: card.name || `Card ${index + 1}`, description: card.desc || "", gameUpgrades: card.upgrades || {}, rawCost: card.cost, effects: [] })), dataStatus: "raw game data" }));
	
	// Parse Skills
	const treeMap = new Map();
	Object.entries(gameData.skill_trees || {}).forEach(([branchId, branchRaw]) => {
		const treeId = branchRaw.skill;
		if (!treeMap.has(treeId)) treeMap.set(treeId, { id: treeId, name: treeId.charAt(0).toUpperCase() + treeId.slice(1), branches: [], skills: [] });
		const tree = treeMap.get(treeId);
		let branchName = branchRaw.name_id.split('_').pop().toUpperCase();
		tree.branches.push({ id: branchName, name: branchName });
		Object.entries(branchRaw.tiers || {}).forEach(([tierIndex, tierObj]) => {
			const tier = Number(tierIndex);
			Object.values(tierObj).forEach(skillId => {
				const skillRaw = gameData.skills[skillId];
				if (!skillRaw) return;
				tree.skills.push({ id: skillId + '-basic', name: skillRaw.name || skillId, branchId: branchName, tier: tier, state: 'basic', pointCost: tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 3 : 4, description: skillRaw.desc_basic || '' });
				tree.skills.push({ id: skillId + '-aced', name: skillRaw.name || skillId, branchId: branchName, tier: tier, state: 'aced', pointCost: tier === 1 ? 3 : tier === 2 ? 4 : tier === 3 ? 6 : 8, description: skillRaw.desc_aced || '' });
			});
		});
	});
	data.skills.trees = Array.from(treeMap.values());

	data.weapons.weapons.push(...rawWeapons);
	data.attachments.attachments.push(...partMap.values());
	data.perks.decks.push(...rawPerks);
	const rawMelees = Object.entries(gameData.melees || {}).map(([gameId, raw]) => ({
		id: `game-melee:${gameId}`,
		name: raw.name || raw.name_id || gameId,
		category: raw.type || 'melee',
		tags: [raw.type || 'melee'],
		description: `Imported from game_data.json. Range: ${raw.stats?.range || 0}, Damage: ${raw.stats?.min_damage || 0}-${raw.stats?.max_damage || 0}`,
		dataStatus: "game_data.json"
	}));
	data.melee.items = rawMelees;

	const rawThrowables = Object.entries(gameData.throwables || {}).map(([gameId, raw]) => ({
		id: `game-throwable:${gameId}`,
		name: raw.name || raw.name_id || gameId,
		category: 'throwable',
		tags: ['throwable'],
		description: `Imported from game_data.json. Max amount: ${raw.max_amount || 0}`,
		dataStatus: "game_data.json"
	}));
	data.throwables.items = rawThrowables;



	const validDeployables = Object.keys(gameData.deployables || {}).filter(k => ['ammo_bag', 'ecm_jammer', 'sentry_gun', 'sentry_gun_silent', 'first_aid_kit', 'trip_mine', 'armor_kit', 'doctor_bag', 'bodybags_bag'].includes(k));
	const rawDeployables = validDeployables.map(gameId => {
		const niceName = gameId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		return {
			id: `game-deployable:${gameId}`,
			name: niceName,
			category: 'deployable',
			tags: ['deployable'],
			description: `Imported from game_data.json.`,
			dataStatus: "game_data.json"
		};
	});
	data.gadgets.items = rawDeployables;

	return { weaponCount: rawWeapons.length, attachmentCount: partMap.size, skillCount: Object.keys(gameData.skills || {}).length, perkCount: rawPerks.length };
}
function allSkillsFrom(catalog) { return (catalog?.trees || []).flatMap((tree) => (tree.skills || []).map((skill) => ({ ...skill, treeName: tree.name, treeId: tree.id }))); }
const allSkills = () => allSkillsFrom(state.data.skills);
const weapon = (id, expectedSlot) => state.data.weapons.weapons.find((item) => item.id === id) || state.data.weapons.weapons.find((item) => supportsSlot(item, expectedSlot || "primary")) || state.data.weapons.weapons[0];
const perk = (id) => state.data.perks.decks.find((item) => item.id === id) || state.data.perks.decks[0];
const armorItem = (id) => state.data.armors.items.find((item) => item.id === id) || state.data.armors.items[0];
const supportsSlot = (item, slot) => (item.slots || [item.slot || item.type]).includes(slot);
const selectedSkills = () => allSkills().filter((skill) => state.selectedSkillIds.includes(skill.id));
const skillBudgetUsed = () => selectedSkills().reduce((sum, skill) => sum + (skill.pointCost || 0), 0);
const skillByName = (skill) => allSkills().filter((item) => item.treeId === skill.treeId && item.branchId === skill.branchId && item.name === skill.name);
const jackOfAllTradesAced = () => Number(state.selectedGameSkills?.jack_of_all_trades || 0) >= 2;
function selectedGadgets() { const gadgets = state.selectedEquipment.gadgets; return Array.isArray(gadgets) ? [gadgets[0] || null, gadgets[1] || null] : [gadgets || null, null]; }
function syncGameSkillsFromProfile() { const profile = currentPlayerProfile(); state.selectedGameSkills = Object.fromEntries(Object.entries(profile?.skills || {}).map(([id, skill]) => [id, Number(skill.unlocked || 0)]).filter(([, level]) => level > 0)); if (!jackOfAllTradesAced()) state.selectedGadgetSlot = 0; }
function setNotice(message) { state.notice = message; renderSkills(); }
function buildStateSnapshot() { return { selectedPrimary: state.selectedPrimary, selectedSecondary: state.selectedSecondary, selectedWeaponSlot: state.selectedWeaponSlot, selectedAttachments: { ...state.selectedAttachments }, selectedSkillIds: [...state.selectedSkillIds], selectedGameSkills: { ...state.selectedGameSkills }, selectedGameTreeId: state.selectedGameTreeId, selectedTree: state.selectedTree, selectedBranch: state.selectedBranch, selectedPerk: state.selectedPerk, selectedEquipment: { ...state.selectedEquipment, gadgets: selectedGadgets() }, selectedHeist: state.selectedHeist, optimizerStyle: state.optimizerStyle, optimizerPurpose: state.optimizerPurpose, weaponCategory: state.weaponCategory }; }
function applyBuildSnapshot(snapshot) { if (!snapshot) return; state.selectedPrimary = snapshot.selectedPrimary || state.selectedPrimary; state.selectedSecondary = snapshot.selectedSecondary || state.selectedSecondary; state.selectedWeaponSlot = snapshot.selectedWeaponSlot || state.selectedWeaponSlot; state.selectedAttachments = snapshot.selectedAttachments ? { ...snapshot.selectedAttachments } : {}; state.selectedSkillIds = Array.isArray(snapshot.selectedSkillIds) ? [...snapshot.selectedSkillIds] : [...DEFAULT_BUILD.selectedSkillIds]; state.selectedGameSkills = snapshot.selectedGameSkills && typeof snapshot.selectedGameSkills === "object" ? { ...snapshot.selectedGameSkills } : {}; state.selectedGameTreeId = snapshot.selectedGameTreeId || state.selectedGameTreeId; state.selectedTree = snapshot.selectedTree || state.selectedTree; state.selectedBranch = snapshot.selectedBranch || state.selectedBranch; state.selectedPerk = snapshot.selectedPerk || state.selectedPerk; const equipment = snapshot.selectedEquipment || DEFAULT_BUILD.selectedEquipment; state.selectedEquipment = { ...DEFAULT_BUILD.selectedEquipment, ...equipment, gadgets: Array.isArray(equipment.gadgets) ? [...equipment.gadgets] : [equipment.gadgets || DEFAULT_BUILD.selectedEquipment.gadgets[0], null] }; state.selectedHeist = snapshot.selectedHeist || state.selectedHeist; state.optimizerStyle = snapshot.optimizerStyle || state.optimizerStyle; state.optimizerPurpose = snapshot.optimizerPurpose || state.optimizerPurpose; state.weaponCategory = snapshot.weaponCategory || "all"; if (!jackOfAllTradesAced()) state.selectedGadgetSlot = 0; }
function resetBuildState(includeSkillIds = true) { const defaults = { ...DEFAULT_BUILD, selectedAttachments: { ...DEFAULT_BUILD.selectedAttachments }, selectedEquipment: { ...DEFAULT_BUILD.selectedEquipment, gadgets: [...DEFAULT_BUILD.selectedEquipment.gadgets] }, selectedSkillIds: includeSkillIds ? [...DEFAULT_BUILD.selectedSkillIds] : [], selectedGameSkills: {} }; state.selectedPrimary = defaults.selectedPrimary; state.selectedSecondary = defaults.selectedSecondary; state.selectedWeaponSlot = defaults.selectedWeaponSlot; state.selectedAttachments = defaults.selectedAttachments; state.selectedSkillIds = defaults.selectedSkillIds; state.selectedGameSkills = defaults.selectedGameSkills; state.selectedGameTreeId = defaults.selectedGameTreeId; state.selectedTree = defaults.selectedTree; state.selectedBranch = defaults.selectedBranch; state.selectedPerk = defaults.selectedPerk; state.selectedEquipment = defaults.selectedEquipment; state.selectedGadgetSlot = 0; state.selectedHeist = defaults.selectedHeist; state.optimizerStyle = defaults.optimizerStyle; state.optimizerPurpose = defaults.optimizerPurpose; state.weaponCategory = defaults.weaponCategory; state.notice = "BUILD RESET"; }
function exportBuild() { const payload = JSON.stringify(buildStateSnapshot(), null, 2); const output = $("build-json-output"); if (output) { output.value = payload; output.focus(); output.select(); } try { navigator.clipboard.writeText(payload); state.notice = "BUILD EXPORTED"; } catch (error) { state.notice = "BUILD JSON READY FOR COPY"; } renderAll(); }
function importBuild() { const output = $("build-json-output"); if (!output || !output.value.trim()) { state.notice = "NO BUILD JSON TO IMPORT"; renderAll(); return; } try { const parsed = JSON.parse(output.value); applyBuildSnapshot(parsed); state.notice = "BUILD IMPORTED"; renderAll(); } catch (error) { state.notice = "INVALID BUILD JSON"; renderAll(); } }
function validateCatalogs(data) { const errors = []; ["weapons", "attachments", "skills", "perks", "heists", "equipment", "gadgets", "melee", "throwables", "armors", "tierList"].forEach((key) => { if (!data[key]) errors.push(`Missing catalog: ${key}`); }); const ids = (items, label) => { const seen = new Set(); items.forEach((item) => { if (!item.id || seen.has(item.id)) errors.push(`Invalid or duplicate ${label} id`); seen.add(item.id); }); }; ids(data.weapons.weapons, "weapon"); ids(data.attachments.attachments, "attachment"); ids(allSkillsFrom(data.skills), "skill"); ids(data.perks.decks, "perk"); ids(data.armors.items, "armor"); if (data.skills.trees.length !== 5 || data.skills.trees.some((tree) => tree.branches.length !== 3)) errors.push("Skills must contain five trees with three branches each"); if (data.skills.skillPointBudget !== 120) errors.push("Skill budget must be 120"); return errors; }
async function loadJson(path) { const response = await fetch(path); if (!response.ok) throw new Error(`${path} returned ${response.status}`); return response.json(); }
async function loadData() { const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => [key, await loadJson(path)])); const data = Object.fromEntries(entries); state.gameData = await loadJson(GAME_DATA_FILE); data.rawCounts = normalizeGameData(state.gameData, data); const errors = validateCatalogs(data); if (errors.length) throw new Error(errors.join("; ")); return data; }
function currentPlayerProfile() { return state.playerData?.skill_profiles?.[state.currentProfileId] || null; }
function playerSkillEntries() { return Object.entries(currentPlayerProfile()?.skills || {}).filter(([, skill]) => Number(skill.unlocked) > 0); }
function playerWeapon(kind) { return Object.values(state.playerData?.inventory?.[kind] || {}).find((item) => item.equipped) || null; }
function loadPlayerData(playerData) {
	if (!playerData || !playerData.skill_profiles || !playerData.inventory) throw new Error("Player JSON must include skill_profiles and inventory.");
	state.playerData = playerData;
	const profileIds = Object.keys(playerData.skill_profiles);
	state.currentProfileId = String(playerData.current_profile ?? profileIds[0] ?? "");
	if (!playerData.skill_profiles[state.currentProfileId]) state.currentProfileId = profileIds[0] || null;
	syncGameSkillsFromProfile();
	state.notice = "PLAYER DATA LOADED";
}
function applyPlayerLoadout() {
	const primary = playerWeapon("primaries");
	const secondary = playerWeapon("secondaries");
	const findGameWeapon = (entry) => entry && state.data.weapons.weapons.find((item) => item.gameWeaponId === entry.weapon_id);
	const primaryItem = findGameWeapon(primary);
	const secondaryItem = findGameWeapon(secondary);
	if (primaryItem) state.selectedPrimary = primaryItem.id;
	if (secondaryItem) state.selectedSecondary = secondaryItem.id;
	state.selectedAttachments = {};
	if (primaryItem) {
		Object.values(primary.blueprint || {}).forEach((partId) => {
			const attachment = state.data.attachments.attachments.find((item) => item.gamePartId === partId && primaryItem.compatibleAttachmentIds.includes(item.id));
			if (attachment) state.selectedAttachments[attachment.slot] = attachment.id;
		});
	}
	state.notice = primaryItem || secondaryItem ? "PLAYER LOADOUT APPLIED" : "NO EQUIPPED WEAPONS MATCH GAME DATA";
	renderAll();
}
function renderPlayerData() {
	if (!state.playerData) return;
	const profileSelect = $("player-profile-select");
	const profileIds = Object.keys(state.playerData.skill_profiles || {}).sort((a, b) => Number(a) - Number(b));
	profileSelect.innerHTML = profileIds.map((id) => `<option value="${escapeHtml(id)}" ${id === state.currentProfileId ? "selected" : ""}>Profile ${escapeHtml(id)}</option>`).join("");
	const primary = playerWeapon("primaries");
	const secondary = playerWeapon("secondaries");
	const weaponName = (entry) => entry ? state.gameData.weapons?.[entry.weapon_id]?.name || entry.weapon_id : "Not equipped";
	const skills = playerSkillEntries();
	const skillRows = skills.slice(0, 40).map(([id, skill]) => {
		const rawName = state.gameData.skills?.[id]?.name;
		const name = rawName && !rawName.startsWith("menu_") ? rawName : id.replaceAll("_", " ");
		return `<li><strong>${escapeHtml(name)}</strong><span>${escapeHtml(id)} / ${Number(skill.unlocked) >= 2 ? "ACED" : "BASIC"}</span></li>`;
	}).join("");
	const meta = state.playerData.meta || {};
	$("player-data-summary").innerHTML = `<div class="player-facts"><div><span>GAME VERSION</span><strong>${escapeHtml(meta.game_version || "Not provided")}</strong></div><div><span>CURRENT PROFILE</span><strong>${escapeHtml(state.currentProfileId || "None")}</strong></div><div><span>UNLOCKED SKILLS</span><strong>${skills.length}</strong></div><div><span>OWNED WEAPONS</span><strong>${Object.keys(state.playerData.inventory?.primaries || {}).length + Object.keys(state.playerData.inventory?.secondaries || {}).length}</strong></div></div><div class="player-equipped"><div><span>PRIMARY</span><strong>${escapeHtml(weaponName(primary))}</strong><small>${escapeHtml(primary?.factory_id || "")}</small></div><div><span>SECONDARY</span><strong>${escapeHtml(weaponName(secondary))}</strong><small>${escapeHtml(secondary?.factory_id || "")}</small></div></div><div class="player-skills"><div class="section-label">PROFILE SKILLS <span>${skills.length} RECORDS / FIRST 40 SHOWN</span></div><ul>${skillRows || "<li>No unlocked skill records in this profile.</li>"}</ul></div>`;
	$("player-data-notice").textContent = state.notice || "Player source loaded.";
}
function renderGameSkillReference() {
	const trees = Object.entries(state.gameData.skill_trees || {}).sort(([left], [right]) => Number(left) - Number(right));
	if (!trees.length) { $("game-skill-reference").innerHTML = "<p class=\"source-note\">No game skill tree records supplied.</p>"; return; }
	if (!trees.some(([id]) => id === state.selectedGameTreeId)) state.selectedGameTreeId = trees[0][0];
	const [treeId, tree] = trees.find(([id]) => id === state.selectedGameTreeId);
	const query = state.gameSkillQuery.trim().toLowerCase();
	const playerSkills = currentPlayerProfile()?.skills || {};
	const treeLabel = (tree.name_id || `tree ${treeId}`).replace(/^st_menu_/, "").replace(/^(mastermind|enforce|enforcer|technician|ghost|fugitive)_?/, "");
	const treeTitle = `${tree.skill || "Skill tree"} / ${treeLabel.replaceAll("_", " ")}`;
	const tierRows = Object.entries(tree.tiers || {}).sort(([left], [right]) => Number(left) - Number(right)).map(([tier, positions]) => {
		const skillIds = Object.values(positions || {}).filter((id) => state.gameData.skills?.[id]);
		const matching = skillIds.filter((id) => `${id} ${state.gameData.skills[id].name || ""} ${state.gameData.skills[id].name_id || ""}`.toLowerCase().includes(query));
		if (!matching.length) return "";
		return `<section class="game-tier-row"><div class="game-tier-heading">TIER ${escapeHtml(tier)}</div><div class="game-tier-skills">${matching.map((id) => {
			const skill = state.gameData.skills[id];
			const name = skill.name && !skill.name.startsWith("menu_") ? skill.name : id.replaceAll("_", " ");
			const level = Number(state.selectedGameSkills[id] || 0);
			const playerLevel = Number(playerSkills[id]?.unlocked || 0);
			const upgrades = [1, 2].map((rank) => Object.values(skill.upgrades?.[String(rank)]?.upgrades || {}).join(", ")).filter(Boolean);
			return `<article class="game-skill-card ${level ? `level-${level}` : ""}"><div class="game-skill-heading"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(id)}</small></div><div class="game-skill-levels"><button type="button" class="${level === 1 ? "active" : ""}" data-game-skill-id="${escapeHtml(id)}" data-game-skill-level="1">BASIC</button><button type="button" class="${level === 2 ? "active" : ""}" data-game-skill-id="${escapeHtml(id)}" data-game-skill-level="2">ACED</button><button type="button" class="${level === 0 ? "active" : ""}" data-game-skill-id="${escapeHtml(id)}" data-game-skill-level="0">CLEAR</button></div><div class="game-skill-origin">BUILD: ${level ? level === 2 ? "ACED" : "BASIC" : "NOT SELECTED"} / PLAYER: ${playerLevel ? playerLevel === 2 ? "ACED" : "BASIC" : "NOT OWNED"}</div>${upgrades.length ? `<small class="game-skill-upgrades">${upgrades.map((value, index) => `${index ? "ACED" : "BASIC"}: ${escapeHtml(value)}`).join(" · ")}</small>` : ""}</article>`;
		}).join("")}</div></section>`;
	}).join("");
	$("game-skill-reference").innerHTML = `<div class="game-tree-toolbar"><div class="section-label">GAME SKILL TREES <span>15 TREES / ${Object.keys(state.gameData.skills || {}).length} SKILLS</span></div><div class="game-tree-tabs">${trees.map(([id, item]) => `<button type="button" class="${id === treeId ? "active" : ""}" data-game-tree-id="${escapeHtml(id)}" title="${escapeHtml(item.name_id || id)}">${escapeHtml(id)} · ${escapeHtml(item.skill || "tree")}</button>`).join("")}</div><div class="game-tree-controls"><strong>${escapeHtml(treeTitle)}</strong><input id="game-skill-search" type="search" value="${escapeHtml(state.gameSkillQuery)}" placeholder="Filter this tree by name or ID" /></div><p class="source-note">Tier layout and skill IDs come from game_data.json. Select Basic or Aced to build the raw skill profile. Costs and gameplay effects remain uncalculated because localization/upgrades are incomplete.</p></div><div class="game-tier-list">${tierRows || "<p class=\"source-note\">No skills match this filter.</p>"}</div>`;
	document.querySelectorAll("[data-game-tree-id]").forEach((button) => button.addEventListener("click", () => { state.selectedGameTreeId = button.dataset.gameTreeId; renderGameSkillReference(); }));
	document.querySelectorAll("[data-game-skill-id]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.gameSkillId; const level = Number(button.dataset.gameSkillLevel); if (level) state.selectedGameSkills[id] = level; else delete state.selectedGameSkills[id]; if (!jackOfAllTradesAced()) state.selectedGadgetSlot = 0; state.notice = `${id.replaceAll("_", " ").toUpperCase()} ${level === 2 ? "ACED" : level === 1 ? "BASIC" : "CLEARED"}`; renderAll(); }));
	$("game-skill-search")?.addEventListener("input", (event) => { state.gameSkillQuery = event.target.value; renderGameSkillReference(); const input = $("game-skill-search"); input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
}
function renderGameWeaponData() {
	const selected = state.data.weapons.weapons.find((item) => item.id === (state.selectedWeaponSlot === "primary" ? state.selectedPrimary : state.selectedSecondary));
	const rawStats = selected?.rawStats;
	$("game-weapon-data").innerHTML = rawStats ? `<div class="section-label">SOURCE GAME STATS <span>${escapeHtml(selected.gameWeaponId)}</span></div><p class="source-note">These are the raw values supplied by the game dataset. Only damage, concealment, and fire interval are mapped into the builder calculator; other game values are shown without guessed conversions.</p><div class="raw-stat-list">${Object.entries(rawStats).map(([key, value]) => `<div><span>${escapeHtml(key.replaceAll("_", " "))}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : "";
}
function attachmentsFor(item) { return state.data.attachments.attachments.filter((attachment) => (item.compatibleAttachmentIds || []).includes(attachment.id)); }
function effectList() { return [...selectedSkills().flatMap((skill) => (skill.effects || []).map((effect) => ({ ...effect, source: skill.name }))), ...(perk(state.selectedPerk).cards || []).flatMap((card) => (card.effects || []).map((effect) => ({ ...effect, source: card.name })))]; }
function computeBuildStats() {
	const primary = weapon(state.selectedPrimary, "primary");
	const secondary = weapon(state.selectedSecondary, "secondary");
	const armor = armorItem(state.selectedEquipment.armor);
	const melee = equipmentItem("melee");
	const throwable = equipmentItem("throwables");
	const gadget1 = equipmentItem("gadgets", 0);
	const gadget2 = jackOfAllTradesAced() ? equipmentItem("gadgets", 1) : null;
	const stats = {};
	BUILD_STATS.forEach((key) => { stats[key] = Number(primary.baseStats?.[key] ?? 0); });
	const sources = Object.fromEntries(BUILD_STATS.map((key) => [key, [{ source: `${primary.name} base${primary.baseStats?.[key] === undefined ? " (not supplied)" : ""}`, value: stats[key] }]]));
	const apply = (stat, value, source, note = "") => {
		if (!Object.prototype.hasOwnProperty.call(stats, stat)) return;
		stats[stat] += Number(value);
		sources[stat].push({ source, value: Number(value), note });
	};
	Object.entries(armor.baseStats || {}).forEach(([stat, value]) => apply(stat, value, `${armor.name} base`, "Equipped armor"));
	apply("damage", Number(secondary.baseStats?.damage ?? 0) * 0.2, `${secondary.name} base`, "20% secondary contribution");
	stats.health = stats.health || 50;
	stats.ammo = stats.ammo || 30;
	
	const applyGear = (item, label) => {
		if (!item) return;
		Object.entries(item.baseStats || {}).forEach(([stat, value]) => apply(stat, value, `${item.name} base`, label));
		(item.effects || []).forEach((effect) => { if (effect.operation === "add") apply(effect.stat, effect.value, `${item.name} effect`, effect.notes || label); });
	};
	applyGear(melee, "Equipped melee");
	applyGear(throwable, "Equipped throwable");
	applyGear(gadget1, "Equipped gadget 1");
	applyGear(gadget2, "Equipped gadget 2");

	Object.values(state.selectedAttachments).forEach((id) => {
		const item = state.data.attachments.attachments.find((entry) => entry.id === id);
		if (item) Object.entries(item.statModifiers || {}).forEach(([stat, value]) => apply(stat, value, item.name, item.efficiency));
	});
	effectList().forEach((effect) => { if (effect.operation === "add") apply(effect.stat, effect.value, effect.source, effect.notes || "Catalog effect"); });
	stats.concealment = Math.max(0, stats.concealment);
	return { stats, sources };
}
function sourceText(entries) { return entries.map((entry) => `${escapeHtml(entry.source)} ${entry.value >= 0 ? "+" : ""}${entry.value}`).join(" · "); }
function formatStatNumber(value) { return String(Number(Number(value).toFixed(1))); }
function renderStatRows(stats, sources, className = "") { return BUILD_STATS.map((key) => `<div class="stat-row ${className}"><span>${STAT_NAMES[key]}</span><strong>${Math.round(stats[key])}</strong><small>${sourceText(sources[key])}</small></div>`).join(""); }
function renderOverview() {
	const result = computeBuildStats();
	const primary = weapon(state.selectedPrimary, "primary");
	const secondary = weapon(state.selectedSecondary, "secondary");
	const armor = armorItem(state.selectedEquipment.armor);
	const skills = selectedSkills();
	const selected = perk(state.selectedPerk);
	const gadgetIds = selectedGadgets();
	const secondaryGadget = state.data.gadgets.items.find((item) => item.id === gadgetIds[1]);
	$("primary-name").textContent = primary.name;
	$("secondary-name").textContent = secondary.name;
	$("primary-summary").textContent = `${primary.category || "weapon"} / ${primary.baseStats.damage} damage`;
	$("secondary-summary").textContent = `${secondary.category || "weapon"} / ${secondary.baseStats.damage} damage`;
	$("skill-summary").textContent = skills.map((skill) => `${skill.name} ${skill.state}`).join(" · ") || "NO CURATED SKILLS SELECTED";
	$("perk-name").textContent = selected.name;
	$("perk-summary").textContent = selected.summary || selected.playstyle;
	$("gadget-name").textContent = equipmentItem("gadgets", 0).name;
	$("gadget-secondary-name").textContent = !jackOfAllTradesAced() ? "LOCKED / JACK OF ALL TRADES ACED" : secondaryGadget?.name || "SELECT GADGET";
	$("gadget-overview-secondary").disabled = !jackOfAllTradesAced();
	$("armor-name").textContent = armor.name;
	$("armor-summary").textContent = `${armor.baseStats.armor} ARMOR / ${armor.baseStats.concealment} CONCEALMENT`;
	$("melee-name").textContent = equipmentItem("melee").name;
	$("throwable-name").textContent = equipmentItem("throwables").name;
	$("loadout-meta").textContent = `${primary.name} + ${secondary.name} / ${selected.name}`;
	$("overview-stats").innerHTML = renderStatRows(result.stats, result.sources);
	$("skill-points-readout").textContent = `${skillBudgetUsed()} / ${state.data.skills.skillPointBudget}`;
	$("overview-sources").innerHTML = `<span class="source-chip">${escapeHtml(primary.name)} BASE</span><span class="source-chip">${escapeHtml(secondary.name)} +20% DAMAGE</span><span class="source-chip">${escapeHtml(armor.name)} ARMOR</span><span class="source-chip">${skills.length} CALCULATOR SKILLS</span><span class="source-chip">${Object.keys(state.selectedGameSkills).length} GAME SKILLS</span><span class="source-chip">${escapeHtml(selected.name)} ACTIVE</span>`;
	$("source-count").textContent = `${BUILD_STATS.length} STATS / LIVE`;
}
function imageMarkup(item) { return item.image ? `<img src="${escapeHtml(item.image)}" alt="" onerror="this.hidden=true" />` : ""; }
function renderWeaponSelectors() { const fill = (id, slot, selected) => { $(id).innerHTML = state.data.weapons.weapons.filter((item) => supportsSlot(item, slot)).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join(""); }; fill("primary-select", "primary", state.selectedPrimary); fill("secondary-select", "secondary", state.selectedSecondary); renderWeaponCategoryTabs(); renderWeaponGrid(); renderWeaponDetail(); }
function renderWeaponCategoryTabs() { const categories = ["all", ...new Set(state.data.weapons.weapons.map((item) => item.category || item.type || "Other"))]; const active = state.weaponCategory || "all"; $("weapon-category-tabs").innerHTML = categories.map((category) => `<button type="button" class="category-tab ${category === active ? "active" : ""}" data-weapon-category="${escapeHtml(category)}">${escapeHtml(category === "all" ? "All" : category)}</button>`).join(""); document.querySelectorAll("[data-weapon-category]").forEach((button) => button.addEventListener("click", () => { state.weaponCategory = button.dataset.weaponCategory; renderWeaponGrid(); renderWeaponCategoryTabs(); })); }
function renderWeaponGrid() { const selectedId = state.selectedWeaponSlot === "primary" ? state.selectedPrimary : state.selectedSecondary; const categoryFilter = state.weaponCategory || "all"; const items = state.data.weapons.weapons.filter((item) => supportsSlot(item, state.selectedWeaponSlot) && (categoryFilter === "all" || (item.category || item.type || "Other") === categoryFilter)); $("weapon-grid").innerHTML = items.map((item) => `<button type="button" class="weapon-tile ${item.id === selectedId ? "selected" : ""}" data-weapon-id="${escapeHtml(item.id)}">${imageMarkup(item)}<span class="tile-category">${escapeHtml(item.category || item.type || "weapon")}</span><strong>${escapeHtml(item.name)}</strong><small>${item.rawStats ? `DMG ${escapeHtml(item.baseStats.damage)} / RAW SPREAD ${escapeHtml(item.rawStats.spread ?? "n/a")}` : `${escapeHtml(item.baseStats.damage)} DMG / ${escapeHtml(item.baseStats.accuracy ?? "n/a")} ACC`}</small></button>`).join(""); document.querySelectorAll("[data-weapon-id]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.weaponId; if (state.selectedWeaponSlot === "primary") state.selectedPrimary = id; else state.selectedSecondary = id; state.selectedAttachments = {}; renderAll(); })); }
function weaponStatTable(item, result) { const base = item.baseStats || {}; return `<table class="stat-table"><thead><tr><th>STAT</th><th>BASE</th><th>EQUIPPED</th><th>DELTA</th></tr></thead><tbody>${["damage", "rpm", "accuracy", "stability", "magSize", "concealment", "threat"].map((key) => { const equipped = result.stats[key] ?? Number(base[key] || 0); const baseValue = Number(base[key] || 0); return `<tr><td>${STAT_NAMES[key]}</td><td>${baseValue}</td><td>${Math.round(equipped)}</td><td class="${equipped - baseValue >= 0 ? "positive" : "negative"}">${equipped - baseValue >= 0 ? "+" : ""}${Math.round(equipped - baseValue)}</td></tr>`; }).join("")}</tbody></table>`; }
function renderWeaponDetail() { const selected = state.selectedWeaponSlot === "primary" ? weapon(state.selectedPrimary, "primary") : weapon(state.selectedSecondary, "secondary"); const result = computeBuildStats(); const attachmentRows = (selected.attachmentSlots || []).map((slot) => { const options = attachmentsFor(selected).filter((item) => item.slot === slot); return `<label>${escapeHtml(slot)}<select data-attachment-slot="${escapeHtml(slot)}"><option value="">NONE</option>${options.map((item) => `<option value="${escapeHtml(item.id)}" ${state.selectedAttachments[slot] === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>`; }).join(""); $("weapon-detail").innerHTML = `<div class="inspector-heading">${imageMarkup(selected)}<div><p class="eyebrow">SELECTED / ${escapeHtml(state.selectedWeaponSlot)}</p><h3>${escapeHtml(selected.name)}</h3><span class="muted">${escapeHtml((selected.tags || []).join(" · "))}</span></div></div><div class="inspector-section"><div class="section-label">BASE / EQUIPPED / DELTA</div>${weaponStatTable(selected, result)}</div><div class="inspector-section"><div class="section-label">ATTACHMENTS <span>LIVE MODIFIERS</span></div><div class="attachment-grid">${attachmentRows || "<span class=\"source-note\">No attachment slots supplied.</span>"}</div></div><div class="inspector-section"><div class="section-label">STAT ORIGIN</div><div class="compact-sources">${BUILD_STATS.map((key) => `<div><strong>${STAT_NAMES[key]}</strong><small>${sourceText(result.sources[key])}</small></div>`).join("")}</div></div>`; document.querySelectorAll("[data-attachment-slot]").forEach((select) => select.addEventListener("change", (event) => { const slot = event.target.dataset.attachmentSlot; if (event.target.value) state.selectedAttachments[slot] = event.target.value; else delete state.selectedAttachments[slot]; renderAll(); })); }

function skillStatus(skill) {
	const pair = skillByName(skill);
	const aced = pair.find(s => s.state === 'aced');
	const basic = pair.find(s => s.state === 'basic');
	if (state.selectedSkillIds.includes(aced.id)) return "aced";
	if (state.selectedSkillIds.includes(basic.id)) return "basic";
	const branchPoints = selectedSkills().filter(s => s.branchId === skill.branchId && !pair.some(p => p.id === s.id)).reduce((sum, s) => sum + s.pointCost, 0);
	const req = skill.tier === 2 ? 1 : skill.tier === 3 ? 3 : skill.tier === 4 ? 18 : 0;
	if (branchPoints < req) return "locked";
	return "available";
}

function buySkill(skill, aced) {
	const pair = skillByName(skill);
	const target = pair.find((item) => item.state === (aced ? "aced" : "basic"));
	if (!target) return;

	const isAlreadySelected = state.selectedSkillIds.includes(target.id);
	if (isAlreadySelected) {
		state.selectedSkillIds = state.selectedSkillIds.filter((id) => !pair.some((item) => item.id === id));
		state.notice = `${target.name.toUpperCase()} REFUNDED`;
		renderAll();
		return;
	}

	const branchPoints = selectedSkills()
		.filter(s => s.branchId === skill.branchId && !pair.some(p => p.id === s.id))
		.reduce((sum, s) => sum + s.pointCost, 0);

	let requiredPoints = 0;
	if (skill.tier === 2) requiredPoints = 1;
	if (skill.tier === 3) requiredPoints = 3;
	if (skill.tier === 4) requiredPoints = 18;

	if (branchPoints < requiredPoints) {
		state.notice = `TIER ${skill.tier} REQUIRES ${requiredPoints} POINTS IN BRANCH`;
		renderSkills();
		return;
	}

	const other = pair.find((item) => item.id !== target.id);
	const nextCost = skillBudgetUsed() - (other && state.selectedSkillIds.includes(other.id) ? other.pointCost : 0) + target.pointCost;
	if (nextCost > state.data.skills.skillPointBudget) {
		state.notice = "NOT ENOUGH SKILL POINTS";
		renderSkills();
		return;
	}
	state.selectedSkillIds = state.selectedSkillIds.filter((id) => !pair.some((item) => item.id === id));
	state.selectedSkillIds.push(target.id);
	state.notice = `${target.name.toUpperCase()} ${target.state.toUpperCase()} PURCHASED`;
	renderAll();
}

function renderSkills() {
	const tree = state.data.skills.trees.find((item) => item.id === state.selectedTree) || state.data.skills.trees[0];
	const branchColumns = tree.branches.map((branch) => {
		const skills = allSkills().filter(s => s.treeId === tree.id && s.branchId === branch.id && s.state === 'basic');
		let tiersHtml = "";
		for (let t = 4; t >= 1; t--) {
			const tierSkills = skills.filter(s => s.tier === t);
			const buttons = tierSkills.map(skill => {
				const st = skillStatus(skill);
				const isAced = state.selectedSkillIds.includes(skill.id.replace('-basic', '-aced'));
				const isBasic = !isAced && state.selectedSkillIds.includes(skill.id);
				const icon = st === "locked" ? "🔒" : isAced ? "🌟" : isBasic ? "⭐" : "➕";
				const stateClass = isAced ? "aced" : isBasic ? "basic" : st;
				return `<button type="button" class="skill-node state-${stateClass}" data-skill-id="${escapeHtml(skill.id)}"><span class="skill-icon">${icon}</span><strong>${escapeHtml(skill.name)}</strong></button>`;
			}).join("");
			tiersHtml += `<div class="skill-tier tier-${t}">${buttons}</div>`;
		}
		return `<div class="skill-branch"><div class="tier-column">${tiersHtml}</div><div class="branch-heading">${escapeHtml(branch.name)}</div></div>`;
	}).join("");

	$("skill-grid").innerHTML = `<div class="skill-toolbar"><div class="tab-row">${state.data.skills.trees.map((item) => `<button type="button" class="tab-button ${item.id === tree.id ? "active" : ""}" data-tree-id="${item.id}">${escapeHtml(item.name)}</button>`).join("")}</div><div class="branch-tabs"><strong class="budget-readout">${skillBudgetUsed()} / ${state.data.skills.skillPointBudget} POINTS</strong></div>${state.notice ? `<p class="interaction-notice">${escapeHtml(state.notice)}</p>` : ""}</div><div class="skill-tree">${branchColumns}</div><p class="source-note">CLICK FOR BASIC. DOUBLE CLICK FOR ACED.</p>`;
	document.querySelectorAll("[data-tree-id]").forEach((button) => button.addEventListener("click", () => { state.selectedTree = button.dataset.treeId; renderSkills(); }));
	document.querySelectorAll("[data-skill-id]").forEach((button) => {
		let clickTimer;
		const skill = allSkills().find((item) => item.id === button.dataset.skillId);
		button.addEventListener("click", () => { clearTimeout(clickTimer); clickTimer = setTimeout(() => buySkill(skill, false), 230); });
		button.addEventListener("dblclick", (event) => { event.preventDefault(); clearTimeout(clickTimer); buySkill(skill, true); });
	});
}
function perkCards(item) { return (item.cards || []).slice().sort((a, b) => a.order - b.order); }
function renderPerks() { const selected = perk(state.selectedPerk); const rawDeck = selected.gamePerkId !== undefined; $("perk-grid").innerHTML = state.data.perks.decks.map((item) => `<button type="button" class="perk-row ${item.id === state.selectedPerk ? "selected" : ""}" data-perk-id="${escapeHtml(item.id)}"><div class="perk-name"><span class="slot-index">${item.gamePerkId !== undefined ? `GAME DECK ${item.gamePerkId}` : "CURATED DECK"}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.playstyle)} / ${escapeHtml(item.summary || "")}</small></div><div class="perk-cards">${perkCards(item).map((card) => `<span class="perk-card-mini"><b>${card.order}</b><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.description)}</small></span>`).join("")}</div></button>`).join(""); const upgrades = rawDeck ? perkCards(selected).flatMap((card) => Object.values(card.gameUpgrades || {}).map((upgrade) => `${card.name}: ${upgrade}`)) : []; $("perk-detail").innerHTML = `<div class="detail-heading"><div><p class="eyebrow">EQUIPPED PERK DECK</p><h3>${escapeHtml(selected.name)}</h3></div><span class="pill cyan-pill">${rawDeck ? "RAW CARDS / EFFECTS NOT NORMALIZED" : "CURATED CALCULATOR MODEL"}</span></div><p>${escapeHtml(selected.description || selected.summary || "")}</p><div class="effect-strip">${perkCards(selected).flatMap((card) => card.effects || []).map((effect) => `<span class="pill">${escapeHtml(STAT_NAMES[effect.stat] || effect.stat)} +${effect.value}</span>`).join("")}</div>${upgrades.length ? `<p class="source-note">RAW UPGRADE IDS: ${upgrades.slice(0, 12).map(escapeHtml).join(" · ")}</p>` : ""}`; document.querySelectorAll("[data-perk-id]").forEach((button) => button.addEventListener("click", () => { state.selectedPerk = button.dataset.perkId; state.notice = `${perk(state.selectedPerk).name.toUpperCase()} EQUIPPED`; renderAll(); })); }
function equipmentItem(kind, slot = 0) {
	const catalog = state.data[kind];
	const selectedId = kind === "gadgets" ? selectedGadgets()[slot] : kind === "armors" ? state.selectedEquipment.armor : state.selectedEquipment[kind];
	return catalog.items.find((item) => item.id === selectedId) || catalog.items[0];
}
function gearPrefix(kind) { return kind === "gadgets" ? "gadget" : kind === "melee" ? "melee" : kind === "throwables" ? "throwable" : "armor"; }
function gearSelectId(kind) { return kind === "melee" ? "melee-select" : `${gearPrefix(kind)}s-select`; }
function equipmentSummary(item) {
	const stats = item.baseStats || {};
	if (Object.keys(stats).length) return Object.entries(stats).map(([key, value]) => `${STAT_NAMES[key] || key} ${value}`).slice(0, 3).join(" / ");
	return (item.effects || []).map((effect) => `${STAT_NAMES[effect.stat] || effect.stat} ${effect.value >= 0 ? "+" : ""}${effect.value}`).join(" / ") || (item.tags || []).join(" / ");
}
function renderEquipment(kind, label) {
	const prefix = gearPrefix(kind);
	const catalog = state.data[kind];
	const items = catalog.items || [];
	const gadgetSlot = kind === "gadgets" ? state.selectedGadgetSlot : 0;
	const gadgetIds = selectedGadgets();
	const selectedId = kind === "gadgets" ? gadgetIds[gadgetSlot] : kind === "armors" ? state.selectedEquipment.armor : state.selectedEquipment[kind];
	const selected = items.find((item) => item.id === selectedId) || (kind === "gadgets" && gadgetSlot === 1 ? null : items[0]);
	const categories = ["all", ...new Set(items.map((item) => item.category || label))];
	const category = categories.includes(state.gearCategories[kind]) ? state.gearCategories[kind] : "all";
	state.gearCategories[kind] = category;
	if (kind === "gadgets") {
		$("gadget-slot-primary").classList.toggle("active", gadgetSlot === 0);
		$("gadget-slot-secondary").classList.toggle("active", gadgetSlot === 1);
		$("gadget-slot-secondary").disabled = !jackOfAllTradesAced();
		$("gadget-slot-status").textContent = jackOfAllTradesAced() ? `EQUIPPED: ${gadgetIds.filter(Boolean).length} / 2` : "SECOND GADGET REQUIRES JACK OF ALL TRADES ACED";
	}
	$(`${kind}-category-tabs`).innerHTML = categories.map((entry) => `<button type="button" class="category-tab ${entry === category ? "active" : ""}" data-gear-category="${kind}" data-category="${escapeHtml(entry)}">${escapeHtml(entry === "all" ? "All" : entry)}</button>`).join("");
	$(gearSelectId(kind)).innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
	$(`${prefix}-grid`).innerHTML = items.filter((item) => category === "all" || (item.category || label) === category).map((item) => `<button type="button" class="weapon-tile ${item.id === selectedId ? "selected" : ""}" data-equipment-kind="${kind}" data-equipment-id="${escapeHtml(item.id)}"><span class="tile-category">${escapeHtml(kind === "gadgets" ? `${label} / SLOT ${gadgetSlot + 1}` : item.category || label)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(equipmentSummary(item))}</small></button>`).join("");
	const result = computeBuildStats();
	if (kind === "armors" && selected) {
		const armorRows = Object.entries(selected.baseStats || {}).map(([key, value]) => { const equippedValue = Number(result.stats[key] || 0); return `<tr><td>${escapeHtml(STAT_NAMES[key] || key)}</td><td>${escapeHtml(value)}</td><td>${formatStatNumber(equippedValue)}</td><td class="${equippedValue - value >= 0 ? "positive" : "negative"}">${equippedValue - value >= 0 ? "+" : ""}${formatStatNumber(equippedValue - value)}</td></tr>`; }).join("");
		const armorSources = Object.keys(selected.baseStats || {}).map((key) => `<div><strong>${escapeHtml(STAT_NAMES[key] || key)}</strong><small>${sourceText(result.sources[key] || [])}</small></div>`).join("");
		$(`${prefix}-detail`).innerHTML = `<div class="inspector-heading"><div><p class="eyebrow">EQUIPPED ARMOR</p><h3>${escapeHtml(selected.name)}</h3><span class="muted">${escapeHtml(selected.unlock)}</span></div></div><div class="inspector-section"><div class="section-label">BASE / EQUIPPED / DELTA</div><table class="stat-table"><thead><tr><th>STAT</th><th>BASE</th><th>EQUIPPED</th><th>DELTA</th></tr></thead><tbody>${armorRows}</tbody></table></div><div class="inspector-section"><div class="section-label">STAT ORIGIN</div><div class="compact-sources">${armorSources}</div></div><p class="source-note">Base PC inventory stats. Skill and perk bonuses are applied separately when supported by the calculator. Source: <a href="${escapeHtml(catalog.source)}" target="_blank" rel="noreferrer">Payday Wiki / Armors</a>.</p>`;
	} else if (selected) {
		const effects = (selected.effects || []).map((effect) => `<div class="stat-row"><span>${escapeHtml(STAT_NAMES[effect.stat] || effect.stat)}</span><strong>${effect.value >= 0 ? "+" : ""}${escapeHtml(effect.value)}</strong><small>${escapeHtml(effect.operation || "Catalog effect")}</small></div>`).join("");
		$(`${prefix}-detail`).innerHTML = `<div class="inspector-heading"><div><p class="eyebrow">SELECTED / ${escapeHtml(kind === "gadgets" ? `GADGET ${gadgetSlot + 1}` : label)}</p><h3>${escapeHtml(selected.name)}</h3><span class="muted">${escapeHtml((selected.tags || []).join(" · "))}</span></div></div><div class="inspector-section"><div class="section-label">ITEM DETAILS</div><p>${escapeHtml(selected.description)}</p>${effects ? `<div class="stat-list">${effects}</div>` : ""}<p class="source-note">Catalog record: ${escapeHtml(selected.dataStatus || "game_data.json")}</p></div>`;
	} else {
		$(`${prefix}-detail`).innerHTML = "<h3>NO GADGET SELECTED</h3><p>Choose an item from this inventory to fill Gadget 2.</p>";
	}
	$(gearSelectId(kind)).addEventListener("change", (event) => setEquipmentItem(kind, event.target.value));
	document.querySelectorAll(`[data-gear-category="${kind}"]`).forEach((button) => button.addEventListener("click", () => { state.gearCategories[kind] = button.dataset.category; renderEquipment(kind, label); }));
	document.querySelectorAll(`[data-equipment-kind="${kind}"]`).forEach((button) => button.addEventListener("click", () => setEquipmentItem(kind, button.dataset.equipmentId)));
}
function setEquipmentItem(kind, id) {
	if (kind === "gadgets") {
		const gadgets = selectedGadgets();
		gadgets[state.selectedGadgetSlot] = id;
		state.selectedEquipment.gadgets = gadgets;
	} else if (kind === "armors") state.selectedEquipment.armor = id;
	else state.selectedEquipment[kind] = id;
	renderAll();
}
function getHeist() { return state.data.heists.find((item) => item.id === state.selectedHeist) || state.data.heists[0]; }
function renderHeists() { const heist = getHeist(); $("heist-grid").innerHTML = state.data.heists.map((item) => `<button class="item-card ${item.id === state.selectedHeist ? "selected" : ""}" data-heist-id="${escapeHtml(item.id)}"><span class="card-kicker">${escapeHtml(item.difficulty)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.enemyProfile)}</p><span class="pill">${escapeHtml(item.style)}</span></button>`).join(""); $("optimizer-heist").innerHTML = state.data.heists.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.selectedHeist ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join(""); $("heist-detail").innerHTML = `<h3>${escapeHtml(heist.name)}</h3><p>${escapeHtml(heist.notes)}</p><div class="pill-row">${(heist.constraints || []).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`; document.querySelectorAll("[data-heist-id]").forEach((button) => button.addEventListener("click", () => { state.selectedHeist = button.dataset.heistId; renderAll(); })); }
function renderTierList() { const category = $("tier-category-filter"); const variant = $("tier-variant-filter"); const selectedCategory = category.value || "all"; const selectedVariant = variant.value || "all"; const groups = state.data.tierList.tiers.filter((group) => selectedCategory === "all" || group.id === selectedCategory); category.innerHTML = `<option value="all">All categories</option>${state.data.tierList.tiers.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("")}`; category.value = selectedCategory; $("tier-list-grid").innerHTML = groups.map((group) => `<section class="tier-group"><div class="tier-group-heading"><span class="eyebrow">${escapeHtml(group.name)}</span><span class="muted">${group.entries.length} entries</span></div>${["S", "A", "B", "C", "D"].map((tier) => { const entries = group.entries.filter((entry) => entry.tier === tier && (selectedVariant === "all" || entry.variant === selectedVariant || !entry.variant)); return entries.length ? `<div class="tier-row tier-${tier.toLowerCase()}"><strong class="tier-label">${tier}</strong><div class="tier-items">${entries.map((entry) => `<article class="tier-item"><div class="tier-item-top"><h3>${escapeHtml(entry.name)}</h3><span class="pill">${escapeHtml(entry.variant || entry.role)}</span></div><p>${escapeHtml(entry.reason)}</p><small class="source-note">${entry.dataStatus === "needs_review" ? "Needs review" : "Editable ranking"}</small></article>`).join("")}</div></div>` : ""; }).join("")}</section>`).join(""); }
function optimize() { const heist = getHeist(); const { stats } = computeBuildStats(); const weights = { overall: { damage: .25, accuracy: .2, stability: .15, health: .2, ammo: .2 }, concealment: { concealment: .55, accuracy: .2, stability: .15, threat: -.1 }, damage: { damage: .55, accuracy: .2, stability: .15, ammo: .1 }, sustain: { ammo: .35, health: .35, damage: .15, stability: .15 } }[state.optimizerPurpose] || {}; const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + (stats[key] || 0) * weight, 0); $("optimizer-result").innerHTML = `<span class="card-kicker">RULE-BASED RECOMMENDATION</span><h3>${escapeHtml(heist.name)} / ${escapeHtml(state.optimizerStyle)}</h3><p class="score-line">SCORE <strong>${Math.round(score)}</strong></p><div class="stat-list">${Object.entries(weights).map(([key, weight]) => `<div class="stat-row"><span>${STAT_NAMES[key] || key}</span><strong>${Math.round((stats[key] || 0) * weight)}</strong><small>weight ${weight.toFixed(2)}</small></div>`).join("")}</div><p><strong>Why:</strong> ${escapeHtml(heist.notes)}</p><p class="source-note">Optimized based on real game data from game_data.json.</p>`; }
function renderAll() { renderOverview(); renderWeaponSelectors(); renderGameWeaponData(); renderSkills(); renderPlayerData(); renderPerks(); renderEquipment("gadgets", "GADGET"); renderEquipment("melee", "MELEE"); renderEquipment("throwables", "THROWABLE"); renderEquipment("armors", "ARMOR"); renderHeists(); renderTierList(); }
function navigate(section) { document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.section === section)); document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === section)); }
function bindNavigation() { document.querySelectorAll("[data-target-section]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.weaponSlot) state.selectedWeaponSlot = button.dataset.weaponSlot; if (button.dataset.gadgetSlot !== undefined) { state.selectedGadgetSlot = Number(button.dataset.gadgetSlot); renderEquipment("gadgets", "GADGET"); } navigate(button.dataset.targetSection); })); document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.section))); }
function autoOptimize() {
	const role = $("auto-opt-role").value;
	const focus = $("auto-opt-focus").value;
	
	resetBuildState();
	state.selectedSkillIds = [];
	state.selectedAttachments = {};

	if (role === "sniper") {
		state.selectedPrimary = "game:r700";
		state.selectedSecondary = "game:glock_18c";
		if (focus === "dps") {
			state.selectedPerk = "game-perk:9";
			state.selectedSkillIds = ["mastermind-sharpshooter", "mastermind-sharpshooter-aced", "enforcer-shotgun", "ghost-silent-killer"];
		} else if (focus === "survival") {
			state.selectedPerk = "game-perk:2";
			state.selectedSkillIds = ["enforcer-tank", "enforcer-tank-aced", "mastermind-medic", "fugitive-revenant"];
		} else {
			state.selectedPerk = "game-perk:4";
			state.selectedSkillIds = ["ghost-shinobi", "ghost-shinobi-aced", "fugitive-acrobat", "fugitive-acrobat-aced"];
		}
	} else if (role === "assault") {
		state.selectedPrimary = "game:m16";
		state.selectedSecondary = "game:b92fs";
		if (focus === "dps") {
			state.selectedPerk = "game-perk:3"; 
			state.selectedSkillIds = ["enforcer-shotgun", "enforcer-shotgun-aced", "ghost-silent-killer"];
		} else if (focus === "survival") {
			state.selectedPerk = "game-perk:1";
			state.selectedSkillIds = ["enforcer-tank", "enforcer-tank-aced", "mastermind-medic"];
		} else {
			state.selectedPerk = "game-perk:5"; 
			state.selectedSkillIds = ["ghost-shinobi", "ghost-shinobi-aced", "fugitive-acrobat"];
		}
	} else if (role === "stealth") {
		state.selectedPrimary = "game:amcar";
		state.selectedSecondary = "game:glock_17";
		state.selectedPerk = "game-perk:7";
		state.selectedSkillIds = ["ghost-shinobi", "ghost-shinobi-aced", "ghost-infiltrator", "ghost-infiltrator-aced", "mastermind-controller"];
	}

	state.notice = `OPTIMIZED FOR ${role.toUpperCase()} / ${focus.toUpperCase()}`;
	renderAll();
}

function bindControls() {
	$("primary-select").addEventListener("change", (event) => { state.selectedPrimary = event.target.value; state.selectedAttachments = {}; renderAll(); });
	$("secondary-select").addEventListener("change", (event) => { state.selectedSecondary = event.target.value; renderAll(); });
	$("optimizer-heist").addEventListener("change", (event) => { state.selectedHeist = event.target.value; renderAll(); });
	$("optimizer-style").addEventListener("change", (event) => { state.optimizerStyle = event.target.value; });
	$("optimizer-purpose").addEventListener("change", (event) => { state.optimizerPurpose = event.target.value; });
	$("optimize-btn").addEventListener("click", optimize);
	$("tier-category-filter").addEventListener("change", renderTierList);
	$("tier-variant-filter").addEventListener("change", renderTierList);
	$("player-profile-select").addEventListener("change", (event) => { state.currentProfileId = event.target.value; syncGameSkillsFromProfile(); renderAll(); });
	$("player-data-file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { loadPlayerData(JSON.parse(await file.text())); renderAll(); } catch (error) { state.notice = `PLAYER DATA ERROR: ${error.message}`; renderPlayerData(); } finally { event.target.value = ""; } });
	$("apply-player-loadout-btn").addEventListener("click", applyPlayerLoadout);
	document.querySelectorAll("[data-gadget-slot-select]").forEach((button) => button.addEventListener("click", () => { if (Number(button.dataset.gadgetSlotSelect) === 1 && !jackOfAllTradesAced()) return; state.selectedGadgetSlot = Number(button.dataset.gadgetSlotSelect); renderEquipment("gadgets", "GADGET"); }));
	document.querySelectorAll("[data-weapon-slot-toggle]").forEach((button) => button.addEventListener("click", () => { state.selectedWeaponSlot = button.dataset.weaponSlotToggle; document.querySelectorAll(".slot-mode-button").forEach((item) => item.classList.toggle("active", item.dataset.weaponSlotToggle === state.selectedWeaponSlot)); renderWeaponGrid(); renderWeaponDetail(); renderGameWeaponData(); }));
	$("export-build-btn").addEventListener("click", exportBuild);
	$("import-build-btn").addEventListener("click", importBuild);
	$("reset-build-btn").addEventListener("click", () => { resetBuildState(); renderAll(); });
	$("reset-attachments-btn").addEventListener("click", () => { state.selectedAttachments = {}; state.notice = "ATTACHMENTS RESET"; renderAll(); });
	$("reset-skills-btn").addEventListener("click", () => { state.selectedSkillIds = []; state.notice = "SKILLS RESET"; renderAll(); });
	$("reset-equipment-btn").addEventListener("click", () => { state.selectedEquipment = { ...DEFAULT_BUILD.selectedEquipment, gadgets: [...DEFAULT_BUILD.selectedEquipment.gadgets] }; state.selectedGadgetSlot = 0; state.notice = "EQUIPMENT RESET"; renderAll(); });
	$("auto-optimize-btn").addEventListener("click", autoOptimize);
}
async function init() { bindNavigation(); try { state.data = await loadData(); try { loadPlayerData(await loadJson(PLAYER_DATA_FILE)); } catch (error) { state.notice = "PLAYER DATA UNAVAILABLE"; } const counts = state.data.rawCounts; $("data-status").textContent = `${counts.weaponCount} GAME WEAPONS / ${counts.attachmentCount} PARTS / ${counts.skillCount} SKILLS`; renderAll(); bindControls(); optimize(); } catch (error) { console.error("INIT ERROR:", error); $("data-status").textContent = "CATALOG ERROR"; $("app-error").hidden = false; $("app-error").textContent = `Unable to load planner data. ${error.message} Start a static server and check the JSON files.`; } }
document.addEventListener("DOMContentLoaded", init);
