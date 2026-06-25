window.Pages = window.Pages || {};

window.Pages.tools = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Plugins</h1>
        <div class="page-subtitle">Registered Soterios modules with version, category, and declared permissions</div>
      </div>

      <div id="toolsGrid"></div>
    `;

    this.load(container);
  },

  async load(container) {
    const grid = container.querySelector('#toolsGrid');
    try {
      const tools = await Api.listTools();
      const byCategory = {};
      tools.forEach((t) => {
        const cat = t.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(t);
      });

      grid.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
        <div style="margin-bottom:20px;">
          <div class="nav-group-label" style="padding-left:0;">${escapeHtml(cat)}</div>
          <div class="grid grid-3">
            ${items.map(renderPluginCard).join('')}
          </div>
        </div>
      `).join('');
    } catch (err) {
      showToolError(grid, err);
    }
  }
};

function renderPluginCard(t) {
  const permissions = (t.permissions || []).map((p) => `<span class="perm-pill">${escapeHtml(p)}</span>`).join('');
  return `
    <div class="tool-card">
      <div class="tool-card-head">
        <div class="tool-card-icon">${iconFor(t.icon)}</div>
        <div>
          <div class="tool-card-name">${escapeHtml(t.name)}</div>
          <div class="tool-card-category">${escapeHtml(t.id)} - v${escapeHtml(t.version)}</div>
        </div>
      </div>
      <div class="tool-card-desc">${escapeHtml(t.description)}</div>
      <div class="permission-list">${permissions || '<span class="perm-pill">no declared permissions</span>'}</div>
      ${t.stub ? '<span class="badge-stub">Not yet implemented</span>' : ''}
    </div>
  `;
}
