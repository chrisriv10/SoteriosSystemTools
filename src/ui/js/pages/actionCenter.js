window.Pages = window.Pages || {};

window.Pages.actions = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Recommendations</h1>
        <div class="page-subtitle">Prioritized actions generated from real Windows protection and system checks</div>
      </div>

      <div class="grid grid-3" id="actionSummary" style="margin-bottom:18px;"></div>

      <div class="panel">
        <div class="flex-between" style="margin-bottom:14px;">
          <div class="panel-title" style="margin-bottom:0;">Recommended Actions</div>
          <button class="btn btn-sm" id="refreshActions">Refresh</button>
        </div>
        <div id="actionList" class="action-list"><div class="empty-state">Loading recommendations...</div></div>
      </div>
    `;

    container.querySelector('#refreshActions').addEventListener('click', () => this.load(container));
    this.load(container);
  },

  async load(container) {
    const listEl = container.querySelector('#actionList');
    const summaryEl = container.querySelector('#actionSummary');
    listEl.innerHTML = '<div class="empty-state">Loading recommendations...</div>';
    try {
      const data = await Api.runTool('security-overview', {});
      const danger = data.recommendations.filter((item) => item.level === 'danger').length;
      const warn = data.recommendations.filter((item) => item.level === 'warn').length;
      summaryEl.innerHTML = `
        <div class="stat-tile"><div class="stat-label">Score</div><div class="stat-value ${data.level}">${data.score}</div></div>
        <div class="stat-tile"><div class="stat-label">Urgent</div><div class="stat-value danger">${danger}</div></div>
        <div class="stat-tile"><div class="stat-label">Review</div><div class="stat-value warn">${warn}</div></div>
      `;
      listEl.innerHTML = data.recommendations.map((item) => this.renderItem(item)).join('');
      listEl.querySelectorAll('[data-action-page]').forEach((btn) => {
        btn.addEventListener('click', () => window.AppRouter.navigate(btn.dataset.actionPage));
      });
    } catch (err) {
      showToolError(listEl, err);
    }
  },

  renderItem(item) {
    return `
      <div class="action-item action-${escapeHtml(item.level)}">
        <div class="action-level">${escapeHtml(item.level)}</div>
        <div class="action-body">
          <div class="action-title">${escapeHtml(item.title)}</div>
          <div class="action-detail">${escapeHtml(item.detail)}</div>
        </div>
        <button class="btn btn-sm" data-action-page="${escapeHtml(item.actionPage)}">Open</button>
      </div>
    `;
  }
};
