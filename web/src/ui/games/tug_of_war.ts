export type TugPanelModel = {
  ropePosition: number;
  winThreshold: number;
  teamAForce: number;
  teamBForce: number;
  currentWord: string;
  wordVersion: number;
  mode: string;
  aliveTeamA: number;
  aliveTeamB: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function renderTugOfWarPanel(model: TugPanelModel): string {
  const normalized =
    model.winThreshold <= 0 ? 50 : clamp((model.ropePosition / model.winThreshold) * 50 + 50, 0, 100);

  return `
    <div style="display:grid;gap:0.7rem">
      <div style="font-size:0.95rem">
        <strong>Word:</strong> ${escapeHtml(model.currentWord)}
        <span style="margin-left:0.5rem;color:#66707a">v${model.wordVersion}</span>
        <span style="margin-left:0.9rem" class="badge">Mode: ${escapeHtml(model.mode)}</span>
      </div>

      <div style="position:relative;height:26px;border-radius:999px;border:1px solid #d8cdb8;background:linear-gradient(90deg,#ffe8de 0%,#fef6ec 50%,#e5f1ff 100%);overflow:hidden;">
        <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:#1d242f;opacity:0.35;"></div>
        <div style="position:absolute;left:${normalized}%;top:1px;transform:translateX(-50%);height:22px;width:12px;border-radius:999px;background:#1d242f;"></div>
      </div>

      <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:0.9rem;">
        <span style="color:#dd5d2a"><strong>Team A</strong> force: ${model.teamAForce}</span>
        <span style="color:#2a7fc1"><strong>Team B</strong> force: ${model.teamBForce}</span>
        <span class="muted">Alive A/B: ${model.aliveTeamA}/${model.aliveTeamB}</span>
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
