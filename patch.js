const fs = require('fs');
let code = fs.readFileSync('planner.js', 'utf8');

const parseSkillsCode = `
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
`;

code = code.replace('data.weapons.weapons.push(...rawWeapons);', parseSkillsCode + '\n\tdata.weapons.weapons.push(...rawWeapons);');

const renderSkillsNew = `
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
		state.notice = \`\${target.name.toUpperCase()} REFUNDED\`;
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
		state.notice = \`TIER \${skill.tier} REQUIRES \${requiredPoints} POINTS IN BRANCH\`;
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
	state.notice = \`\${target.name.toUpperCase()} \${target.state.toUpperCase()} PURCHASED\`;
	renderAll();
}

function renderSkills() {
	const tree = state.data.skills.trees.find((item) => item.id === state.selectedTree) || state.data.skills.trees[0];
	const branchColumns = tree.branches.map((branch) => {
		const skills = tree.skills.filter(s => s.branchId === branch.id && s.state === 'basic');
		let tiersHtml = "";
		for (let t = 4; t >= 1; t--) {
			const tierSkills = skills.filter(s => s.tier === t);
			const buttons = tierSkills.map(skill => {
				const st = skillStatus(skill);
				const icon = st === "locked" ? "🔒" : st === "aced" ? "🌟" : st === "basic" ? "⭐" : "➕";
				return \`<button type="button" class="skill-node state-\${st}" data-skill-id="\${escapeHtml(skill.id)}"><span class="skill-icon">\${icon}</span><strong>\${escapeHtml(skill.name)}</strong></button>\`;
			}).join("");
			tiersHtml += \`<div class="skill-tier tier-\${t}">\${buttons}</div>\`;
		}
		return \`<div class="skill-branch"><div class="tier-column">\${tiersHtml}</div><div class="branch-heading">\${escapeHtml(branch.name)}</div></div>\`;
	}).join("");

	$("skill-grid").innerHTML = \`<div class="skill-toolbar"><div class="tab-row">\${state.data.skills.trees.map((item) => \`<button type="button" class="tab-button \${item.id === tree.id ? "active" : ""}" data-tree-id="\${item.id}">\${escapeHtml(item.name)}</button>\`).join("")}</div><div class="branch-tabs"><strong class="budget-readout">\${skillBudgetUsed()} / \${state.data.skills.skillPointBudget} POINTS</strong></div>\${state.notice ? \`<p class="interaction-notice">\${escapeHtml(state.notice)}</p>\` : ""}</div><div class="skill-tree">\${branchColumns}</div><p class="source-note">CLICK FOR BASIC. DOUBLE CLICK FOR ACED.</p>\`;
	document.querySelectorAll("[data-tree-id]").forEach((button) => button.addEventListener("click", () => { state.selectedTree = button.dataset.treeId; renderSkills(); }));
	document.querySelectorAll("[data-skill-id]").forEach((button) => {
		let clickTimer;
		const skill = allSkills().find((item) => item.id === button.dataset.skillId);
		button.addEventListener("click", () => { clearTimeout(clickTimer); clickTimer = setTimeout(() => buySkill(skill, false), 230); });
		button.addEventListener("dblclick", (event) => { event.preventDefault(); clearTimeout(clickTimer); buySkill(skill, true); });
	});
}
`;

code = code.replace(/function skillState.*?function perkCards/s, renderSkillsNew + '\nfunction perkCards');

fs.writeFileSync('planner.js', code);
