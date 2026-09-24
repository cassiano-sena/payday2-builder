const weaponCatalog = [
  {
    id: "amcar",
    name: "AMCAR",
    type: "primary",
    baseStats: { damage: 30, rpm: 750, accuracy: 55, stability: 48, magSize: 30, concealment: 28, threat: 18 }
  },
  {
    id: "m4",
    name: "M4",
    type: "primary",
    baseStats: { damage: 34, rpm: 700, accuracy: 62, stability: 52, magSize: 32, concealment: 24, threat: 22 }
  },
  {
    id: "m308",
    name: "M308",
    type: "primary",
    baseStats: { damage: 45, rpm: 500, accuracy: 68, stability: 60, magSize: 20, concealment: 18, threat: 27 }
  },
  {
    id: "deagle",
    name: "Deagle",
    type: "secondary",
    baseStats: { damage: 43, rpm: 300, accuracy: 62, stability: 54, magSize: 9, concealment: 22, threat: 25 }
  },
  {
    id: "glock",
    name: "Glock 17",
    type: "secondary",
    baseStats: { damage: 28, rpm: 450, accuracy: 58, stability: 49, magSize: 17, concealment: 35, threat: 15 }
  }
];

const skillCatalog = [
  { id: "stealth-silence", name: "Silent Movement", tree: "stealth", stat: "concealment", value: 12 },
  { id: "precision", name: "Steady Grip", tree: "combat", stat: "accuracy", value: 10 },
  { id: "resilience", name: "Toughness", tree: "survival", stat: "health", value: 18 },
  { id: "ammo-boost", name: "Ammo Resupply", tree: "support", stat: "ammo", value: 15 },
  { id: "threat-rise", name: "Aggressive Presence", tree: "combat", stat: "threat", value: 16 }
];

const perkCatalog = [
  {
    id: "crew-chief",
    name: "Crew Chief",
    summary: "Team support + armor",
    bonuses: { health: 12, ammo: 8, threat: 8 }
  },
  {
    id: "hitman",
    name: "Hitman",
    summary: "Precision-focused damage",
    bonuses: { damage: 14, accuracy: 12 }
  },
  {
    id: "sociopath",
    name: "Sociopath",
    summary: "High-risk aggression",
    bonuses: { threat: 18, damage: 10 }
  }
];

const state = {
  selectedPrimary: "amcar",
  selectedSecondary: "deagle",
  selectedSkillIds: ["stealth-silence", "precision", "resilience"],
  selectedPerk: "crew-chief",
  selectedHeist: "shadow-raid",
  currentSection: "overview",
  optimizerStyle: "stealth"
};

const fallbackHeists = [
  {
    id: "shadow-raid",
    name: "Shadow Raid",
    difficulty: "Hard",
    style: "stealth",
    priorityStats: { concealment: 0.3, accuracy: 0.25, ammo: 0.15, threat: 0.1, stability: 0.2 },
    enemyProfile: "High sniper pressure and layered patrols",
    constraints: ["Silent movement", "No loud gunfight", "Low detection"],
    recommendedSkills: ["Silent Movement", "Steady Grip"],
    notes: "Build around stealth, concealment, and accuracy while keeping enough ammo for long routes."
  },
  {
    id: "bulldozer-hunt",
    name: "Bulldozer Hunt",
    difficulty: "Very Hard",
    style: "loud",
    priorityStats: { damage: 0.35, threat: 0.25, ammo: 0.2, accuracy: 0.1, stability: 0.1 },
    enemyProfile: "Heavy shock units and armored pressure",
    constraints: ["Time-sensitive assault", "High sustained damage", "Strong threat control"],
    recommendedSkills: ["Aggressive Presence", "Ammo Resupply"],
    notes: "Prioritize killing power and stable crowd control to slaughter armored enemies before they close in."
  },
  {
    id: "solo-farm",
    name: "Solo Farm",
    difficulty: "Medium",
    style: "solo",
    priorityStats: { ammo: 0.25, health: 0.2, damage: 0.2, stability: 0.15, concealment: 0.2 },
    enemyProfile: "Mid-range waves with low to medium pressure",
    constraints: ["Sustainability", "Efficient ammo use", "Low downtime"],
    recommendedSkills: ["Toughness", "Ammo Resupply"],
    notes: "The best solo builds keep ammo flow and survivability high without sacrificing enough damage to clear waves."
  },
  {
    id: "bomb-forest",
    name: "The Bomb: Forest",
    difficulty: "Very Hard",
    style: "stealth",
    priorityStats: { accuracy: 0.25, concealment: 0.25, stability: 0.2, ammo: 0.15, threat: 0.15 },
    enemyProfile: "Coordination-heavy patrol routes and long sightlines",
    constraints: ["Precision shots", "Minimal detection", "Controlled approach"],
    recommendedSkills: ["Silent Movement", "Steady Grip"],
    notes: "This heist rewards careful movement, stable aim, and avoiding noisy engagement."
  }
];

const statNames = {
  damage: "Damage",
  rpm: "RPM",
  accuracy: "Accuracy",
  stability: "Stability",
  magSize: "Ammo",
  concealment: "Concealment",
  threat: "Threat",
  health: "Health",
  ammo: "Ammo reserve"
};

function getWeapon(id) {
  return weaponCatalog.find((weapon) => weapon.id === id);
}

function getSkillsByIds(ids) {
  return skillCatalog.filter((skill) => ids.includes(skill.id));
}

function getPerk(id) {
  return perkCatalog.find((perk) => perk.id === id);
}

function computeBuildStats() {
  const primary = getWeapon(state.selectedPrimary);
  const secondary = getWeapon(state.selectedSecondary);
  const skillBonuses = getSkillsByIds(state.selectedSkillIds);

  const merged = {
    damage: primary.baseStats.damage + secondary.baseStats.damage * 0.2,
    rpm: primary.baseStats.rpm,
    accuracy: primary.baseStats.accuracy + skillBonuses.filter((s) => s.stat === "accuracy").reduce((sum, skill) => sum + skill.value, 0),
    stability: primary.baseStats.stability + skillBonuses.filter((s) => s.stat === "stability").reduce((sum, skill) => sum + skill.value, 0),
    magSize: primary.baseStats.magSize,
    concealment: Math.max(10, primary.baseStats.concealment + skillBonuses.filter((s) => s.stat === "concealment").reduce((sum, skill) => sum + skill.value, 0)),
    threat: primary.baseStats.threat + skillBonuses.filter((s) => s.stat === "threat").reduce((sum, skill) => sum + skill.value, 0),
    health: 50 + skillBonuses.filter((s) => s.stat === "health").reduce((sum, skill) => sum + skill.value, 0),
    ammo: 30 + skillBonuses.filter((s) => s.stat === "ammo").reduce((sum, skill) => sum + skill.value, 0)
  };

  const perk = getPerk(state.selectedPerk);
  if (perk) {
    Object.entries(perk.bonuses).forEach(([key, value]) => {
      if (merged[key] !== undefined) {
        merged[key] += value;
      }
    });
  }

  return merged;
}

function renderOverview() {
  const stats = computeBuildStats();
  const primary = getWeapon(state.selectedPrimary);
  const secondary = getWeapon(state.selectedSecondary);
  const selectedSkills = getSkillsByIds(state.selectedSkillIds);
  const perk = getPerk(state.selectedPerk);

  document.getElementById("overall-score").textContent = Math.round((stats.damage + stats.accuracy + stats.threat + stats.health + stats.concealment) / 5);
  document.getElementById("damage-score").textContent = Math.round(stats.damage);
  document.getElementById("accuracy-score").textContent = Math.round(stats.accuracy);
  document.getElementById("threat-score").textContent = Math.round(stats.threat);

  document.getElementById("primary-name").textContent = primary.name;
  document.getElementById("primary-damage").textContent = primary.baseStats.damage;
  document.getElementById("primary-rpm").textContent = primary.baseStats.rpm;
  document.getElementById("primary-accuracy").textContent = primary.baseStats.accuracy;

  document.getElementById("secondary-name").textContent = secondary.name;
  document.getElementById("secondary-damage").textContent = secondary.baseStats.damage;
  document.getElementById("secondary-rpm").textContent = secondary.baseStats.rpm;
  document.getElementById("secondary-accuracy").textContent = secondary.baseStats.accuracy;

  document.getElementById("skill-summary").textContent = selectedSkills.map((skill) => skill.name).join(", ");
  const skillListEl = document.getElementById("skill-list");
  skillListEl.innerHTML = selectedSkills.map((skill) => `<li>${skill.name} (${skill.stat})</li>`).join("");

  document.getElementById("perk-name").textContent = perk.name;
  document.getElementById("perk-summary").textContent = perk.summary;
}

function renderWeaponSelectors() {
  const primarySelect = document.getElementById("primary-select");
  const secondarySelect = document.getElementById("secondary-select");

  primarySelect.innerHTML = weaponCatalog
    .filter((weapon) => weapon.type === "primary")
    .map((weapon) => `<option value="${weapon.id}" ${weapon.id === state.selectedPrimary ? "selected" : ""}>${weapon.name}</option>`)
    .join("");

  secondarySelect.innerHTML = weaponCatalog
    .filter((weapon) => weapon.type === "secondary")
    .map((weapon) => `<option value="${weapon.id}" ${weapon.id === state.selectedSecondary ? "selected" : ""}>${weapon.name}</option>`)
    .join("");

  renderWeaponDetail();
}

function renderWeaponDetail() {
  const primary = getWeapon(state.selectedPrimary);
  const secondary = getWeapon(state.selectedSecondary);
  const detailEl = document.getElementById("weapon-detail");

  detailEl.innerHTML = `
    <h3>Selected loadout</h3>
    <div class="stat-list">
      <div><span>Primary</span><strong>${primary.name}</strong></div>
      <div><span>Damage</span><strong>${primary.baseStats.damage}</strong></div>
      <div><span>RPM</span><strong>${primary.baseStats.rpm}</strong></div>
      <div><span>Accuracy</span><strong>${primary.baseStats.accuracy}</strong></div>
      <div><span>Secondary</span><strong>${secondary.name}</strong></div>
      <div><span>Damage</span><strong>${secondary.baseStats.damage}</strong></div>
      <div><span>RPM</span><strong>${secondary.baseStats.rpm}</strong></div>
      <div><span>Accuracy</span><strong>${secondary.baseStats.accuracy}</strong></div>
    </div>
  `;
}

function renderSkills() {
  const grid = document.getElementById("skill-grid");
  grid.innerHTML = skillCatalog
    .map((skill) => {
      const selected = state.selectedSkillIds.includes(skill.id);
      return `
        <button class="card ${selected ? "selected" : ""}" data-skill-id="${skill.id}">
          <h3>${skill.name}</h3>
          <p>${skill.tree}</p>
          <span class="pill">${skill.stat}: +${skill.value}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-skill-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const skillId = button.dataset.skillId;
      if (state.selectedSkillIds.includes(skillId)) {
        state.selectedSkillIds = state.selectedSkillIds.filter((id) => id !== skillId);
      } else {
        state.selectedSkillIds = [...state.selectedSkillIds, skillId];
      }
      renderSkills();
      renderOverview();
    });
  });
}

function renderPerks() {
  const grid = document.getElementById("perk-grid");
  grid.innerHTML = perkCatalog
    .map((perk) => `
      <button class="card ${state.selectedPerk === perk.id ? "selected" : ""}" data-perk-id="${perk.id}">
        <h3>${perk.name}</h3>
        <p>${perk.summary}</p>
        <span class="pill">${Object.entries(perk.bonuses).map(([key, value]) => `${statNames[key] || key}: +${value}`).join(" | ")}</span>
      </button>
    `)
    .join("");

  document.querySelectorAll("[data-perk-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPerk = button.dataset.perkId;
      renderPerks();
      renderOverview();
    });
  });
}

async function loadHeists() {
  try {
    const response = await fetch("data/heists.json");
    const data = await response.json();
    return Array.isArray(data) ? data : fallbackHeists;
  } catch (error) {
    return fallbackHeists;
  }
}

function renderHeistCards(heists) {
  const grid = document.getElementById("heist-grid");
  const selector = document.getElementById("optimizer-heist");

  grid.innerHTML = heists
    .map((heist) => `
      <button class="card ${state.selectedHeist === heist.id ? "selected" : ""}" data-heist-id="${heist.id}">
        <h3>${heist.name}</h3>
        <p>${heist.style}</p>
        <span class="pill">${heist.difficulty}</span>
      </button>
    `)
    .join("");

  selector.innerHTML = heists
    .map((heist) => `<option value="${heist.id}" ${heist.id === state.selectedHeist ? "selected" : ""}>${heist.name}</option>`)
    .join("");

  document.querySelectorAll("[data-heist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedHeist = button.dataset.heistId;
      renderHeistCards(heists);
      renderHeistDetail(heists);
      renderOptimizerResult(heists);
    });
  });
}

function renderHeistDetail(heists) {
  const selectedHeist = heists.find((heist) => heist.id === state.selectedHeist) || heists[0];
  const detail = document.getElementById("heist-detail");

  detail.innerHTML = `
    <h3>${selectedHeist.name}</h3>
    <p>${selectedHeist.notes}</p>
    <div class="stat-list">
      <div><span>Style</span><strong>${selectedHeist.style}</strong></div>
      <div><span>Difficulty</span><strong>${selectedHeist.difficulty}</strong></div>
      <div><span>Enemy profile</span><strong>${selectedHeist.enemyProfile}</strong></div>
    </div>
    <div>
      <h4>Priority stats</h4>
      ${Object.entries(selectedHeist.priorityStats)
        .map(([key, value]) => `<span class="pill">${statNames[key] || key}: ${value}</span>`)
        .join("")}
    </div>
    <div>
      <h4>Constraints</h4>
      ${selectedHeist.constraints.map((constraint) => `<span class="pill">${constraint}</span>`).join("")}
    </div>
  `;
}

function scoreForHeist(buildStats, heist) {
  const total = Object.entries(heist.priorityStats).reduce((sum, [statName, weight]) => {
    const value = buildStats[statName] ?? 0;
    return sum + value * weight;
  }, 0);

  return Math.round(total * 10);
}

function renderOptimizerResult(heists) {
  const selectedHeist = heists.find((heist) => heist.id === state.selectedHeist) || heists[0];
  const buildStats = computeBuildStats();
  const score = scoreForHeist(buildStats, selectedHeist);

  const result = document.getElementById("optimizer-result");
  result.innerHTML = `
    <h3>Recommended setup for ${selectedHeist.name}</h3>
    <p>Base score: <strong>${score}</strong></p>
    <div class="stat-list">
      ${Object.entries(selectedHeist.priorityStats)
        .map(([key, weight]) => `<div><span>${statNames[key] || key}</span><strong>${buildStats[key] ?? 0} / weight ${weight}</strong></div>`)
        .join("")}
    </div>
    <p>
      Recommended focus: ${selectedHeist.recommendedSkills.join(", ")}
    </p>
  `;
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.section).classList.add("active");
    });
  });
}

function bindControls() {
  document.getElementById("primary-select").addEventListener("change", (event) => {
    state.selectedPrimary = event.target.value;
    renderOverview();
    renderWeaponDetail();
  });

  document.getElementById("secondary-select").addEventListener("change", (event) => {
    state.selectedSecondary = event.target.value;
    renderOverview();
    renderWeaponDetail();
  });

  document.getElementById("optimizer-heist").addEventListener("change", (event) => {
    state.selectedHeist = event.target.value;
    renderHeistCards(document.querySelectorAll("[data-heist-id]").length ? fallbackHeists : fallbackHeists);
  });

  document.getElementById("optimizer-style").addEventListener("change", (event) => {
    state.optimizerStyle = event.target.value;
  });

  document.getElementById("optimize-btn").addEventListener("click", async () => {
    const heists = await loadHeists();
    const heist = heists.find((entry) => entry.id === state.selectedHeist) || heists[0];
    const buildStats = computeBuildStats();
    const score = scoreForHeist(buildStats, heist);

    document.getElementById("optimizer-result").innerHTML = `
      <h3>${heist.name} recommendation</h3>
      <p>Projected score: <strong>${score}</strong></p>
      <p>Playstyle: <strong>${state.optimizerStyle}</strong></p>
      <p>Focus on: ${heist.recommendedSkills.join(", ")}</p>
      <p>${heist.notes}</p>
    `;
  });
}

async function init() {
  bindNavigation();
  renderOverview();
  renderWeaponSelectors();
  renderSkills();
  renderPerks();

  const heists = await loadHeists();
  renderHeistCards(heists);
  renderHeistDetail(heists);
  renderOptimizerResult(heists);
  bindControls();
}

document.addEventListener("DOMContentLoaded", init);
