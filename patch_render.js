const fs = require('fs');
let code = fs.readFileSync('planner.js', 'utf8');

const replacement = `function renderSkills() {
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
				return \`<button type="button" class="skill-node state-\${stateClass}" data-skill-id="\${escapeHtml(skill.id)}"><span class="skill-icon">\${icon}</span><strong>\${escapeHtml(skill.name)}</strong></button>\`;
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
}`;

code = code.replace(/function renderSkills\(\) \{[\s\S]*?(?=function perkCards)/, replacement + '\n');
fs.writeFileSync('planner.js', code);
