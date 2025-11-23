class IntegrationPanel {
  constructor() {
    this.currentMode = 'normal';
    this.currentTab = 'normal';
    this.config = {};
    this.metrics = {};
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadConfiguration();
    this.renderIntegrations();
    this.loadTabContent();
  }

  setupEventListeners() {
    // Mode selector
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        this.switchMode(mode);
      });
    });

    // Tab selector
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });
  }

  switchMode(mode) {
    this.currentMode = mode;

    // Update active button
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // Show/hide shield warning
    const warning = document.querySelector('.shield-warning');
    const shieldTab = document.querySelector('.shield-tab');
    const shieldActions = document.querySelectorAll('.shield-actions');

    if (mode === 'shield') {
      warning.classList.add('show');
      shieldTab.style.display = 'block';
      shieldActions.forEach((action) => action.classList.add('show'));
    } else {
      warning.classList.remove('show');
      shieldTab.style.display = 'none';
      shieldActions.forEach((action) => action.classList.remove('show'));
    }

    this.renderIntegrations();
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update active tab
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    this.loadTabContent();
  }

  async loadConfiguration() {
    try {
      const response = await fetch('/api/integrations/config');
      if (response.ok) {
        this.config = await response.json();
      } else {
        console.error('Failed to load configuration');
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }

  async loadMetrics() {
    try {
      const response = await fetch('/api/integrations/metrics');
      if (response.ok) {
        this.metrics = await response.json();
      } else {
        console.error('Failed to load metrics');
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  renderIntegrations() {
    const grid = document.getElementById('integrationsGrid');
    grid.innerHTML = '<div class="loading">Cargando integraciones...</div>';

    if (!this.config.platforms) {
      grid.innerHTML = '<div class="error">No se pudo cargar la configuración</div>';
      return;
    }

    const platforms = Object.keys(this.config.platforms);
    if (platforms.length === 0) {
      grid.innerHTML = '<div class="error">No hay integraciones configuradas</div>';
      return;
    }

    grid.innerHTML = '';
    platforms.forEach((platform) => {
      const card = this.createIntegrationCard(platform, this.config.platforms[platform]);
      grid.appendChild(card);
    });
  }

  createIntegrationCard(platform, config) {
    const card = document.createElement('div');
    card.className = 'integration-card';
    card.innerHTML = `
            <div class="integration-header">
                <div class="integration-title">
                    ${this.getPlatformIcon(platform)} ${this.getPlatformName(platform)}
                </div>
                <div class="integration-status ${config.enabled ? 'status-enabled' : 'status-disabled'}">
                    ${config.enabled ? 'Activa' : 'Inactiva'}
                </div>
            </div>

            <!-- Tone Configuration -->
            <div class="config-section">
                <label class="config-label">Tono</label>
                <select class="config-input tone-select" data-platform="${platform}">
                    <option value="sarcastic" ${config.tone === 'sarcastic' ? 'selected' : ''}>Sarcástico</option>
                    <option value="ironic" ${config.tone === 'ironic' ? 'selected' : ''}>Irónico</option>
                    <option value="absurd" ${config.tone === 'absurd' ? 'selected' : ''}>Absurdo</option>
                </select>
            </div>

            <!-- Humor Type -->
            <div class="config-section">
                <label class="config-label">Tipo de Humor</label>
                <select class="config-input humor-select" data-platform="${platform}">
                    <option value="witty" ${config.humorType === 'witty' ? 'selected' : ''}>Ingenioso</option>
                    <option value="clever" ${config.humorType === 'clever' ? 'selected' : ''}>Inteligente</option>
                    <option value="playful" ${config.humorType === 'playful' ? 'selected' : ''}>Juguetón</option>
                </select>
            </div>

            <!-- Response Frequency -->
            <div class="config-section">
                <label class="config-label">Frecuencia de Respuesta</label>
                <div class="slider-container">
                    <input type="range" min="0" max="1" step="0.1" value="${config.responseFrequency || 1}" 
                           class="slider frequency-slider" data-platform="${platform}">
                    <div class="slider-value">${Math.round((config.responseFrequency || 1) * 100)}%</div>
                </div>
            </div>

            <!-- Trigger Words -->
            <div class="config-section">
                <label class="config-label">Palabras Clave</label>
                <input type="text" class="config-input trigger-input" data-platform="${platform}"
                       value="${(config.triggerWords || []).join(', ')}" 
                       placeholder="roast, burn, insult">
                <div class="trigger-words">
                    ${(config.triggerWords || [])
                      .map((word) => `<span class="trigger-word">${word}</span>`)
                      .join('')}
                </div>
            </div>

            <!-- Shield Actions (only show in shield mode) -->
            <div class="config-section shield-actions">
                <label class="config-label">Acciones Automáticas Shield</label>
                ${this.renderShieldActions(platform, config.shieldActions)}
            </div>

            <!-- Preview Section -->
            <div class="preview-section">
                <label class="config-label">Vista Previa de Roast</label>
                <button class="preview-btn" data-platform="${platform}">Generar Ejemplo</button>
                <div class="preview-result" id="preview-${platform}">
                    Haz clic en "Generar Ejemplo" para ver un roast de muestra
                </div>
            </div>
        `;

    this.setupCardEventListeners(card, platform);
    return card;
  }

  renderShieldActions(platform, shieldActions) {
    if (!shieldActions) return '';

    const actions = [
      { key: 'muteEnabled', label: 'Silenciar usuario' },
      { key: 'blockEnabled', label: 'Bloquear usuario' },
      { key: 'reportEnabled', label: 'Reportar usuario' },
      { key: 'removeComments', label: 'Eliminar comentarios' }
    ];

    return actions
      .map(
        (action) => `
            <label class="action-label">
                <input type="checkbox" class="action-checkbox" 
                       data-platform="${platform}" data-action="${action.key}"
                       ${shieldActions[action.key] ? 'checked' : ''}>
                ${action.label}
            </label>
        `
      )
      .join('');
  }

  setupCardEventListeners(card, platform) {
    // Tone selector
    const toneSelect = card.querySelector('.tone-select');
    toneSelect.addEventListener('change', (e) => {
      this.updateConfig(platform, 'tone', e.target.value);
    });

    // Humor type selector
    const humorSelect = card.querySelector('.humor-select');
    humorSelect.addEventListener('change', (e) => {
      this.updateConfig(platform, 'humorType', e.target.value);
    });

    // Frequency slider
    const frequencySlider = card.querySelector('.frequency-slider');
    const sliderValue = card.querySelector('.slider-value');

    frequencySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      sliderValue.textContent = Math.round(value * 100) + '%';
      this.updateConfig(platform, 'responseFrequency', value);
    });

    // Trigger words
    const triggerInput = card.querySelector('.trigger-input');
    triggerInput.addEventListener('blur', (e) => {
      const words = e.target.value
        .split(',')
        .map((w) => w.trim())
        .filter((w) => w);
      this.updateConfig(platform, 'triggerWords', words);
      this.updateTriggerWordsDisplay(card, words);
    });

    // Preview button
    const previewBtn = card.querySelector('.preview-btn');
    previewBtn.addEventListener('click', async () => {
      await this.generatePreview(platform);
    });

    // Shield action checkboxes
    card.querySelectorAll('.action-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const action = e.target.getAttribute('data-action');
        this.updateShieldAction(platform, action, e.target.checked);
      });
    });
  }

  updateTriggerWordsDisplay(card, words) {
    const container = card.querySelector('.trigger-words');
    container.innerHTML = words.map((word) => `<span class="trigger-word">${word}</span>`).join('');
  }

  async updateConfig(platform, key, value) {
    try {
      const configData = { [key]: value };

      const response = await fetch(`/api/integrations/config/${platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      if (response.ok) {
        const result = await response.json();
        this.showSuccess(`Configuración de ${platform} actualizada`);
      } else {
        this.showError(`Error actualizando configuración de ${platform}`);
      }
    } catch (error) {
      console.error('Error updating config:', error);
      this.showError(`Error actualizando configuración de ${platform}`);
    }
  }

  async updateShieldAction(platform, action, enabled) {
    try {
      const configData = {
        shieldActions: {
          ...this.config.platforms[platform].shieldActions,
          [action]: enabled
        }
      };

      await this.updateConfig(platform, 'shieldActions', configData.shieldActions);
    } catch (error) {
      console.error('Error updating shield action:', error);
    }
  }

  async generatePreview(platform) {
    const previewResult = document.getElementById(`preview-${platform}`);
    previewResult.textContent = 'Generando ejemplo...';

    try {
      const platformConfig = this.config.platforms[platform];
      const response = await fetch('/api/roast/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Este es un comentario de prueba para generar un roast de ejemplo',
          tone: platformConfig.tone,
          humorType: platformConfig.humorType
        })
      });

      if (response.ok) {
        const result = await response.json();
        previewResult.innerHTML = `<strong>Ejemplo:</strong> "${result.roast}"`;
      } else {
        previewResult.textContent = 'Error generando ejemplo';
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      previewResult.textContent = 'Error generando ejemplo';
    }
  }

  async loadTabContent() {
    const tabContent = document.getElementById('tabContent');
    tabContent.innerHTML = '<div class="loading">Cargando...</div>';

    try {
      switch (this.currentTab) {
        case 'normal':
        case 'integration':
        case 'shield':
          await this.loadLogs(this.currentTab);
          break;
        case 'metrics':
          await this.loadMetrics();
          this.renderMetrics();
          break;
      }
    } catch (error) {
      console.error('Error loading tab content:', error);
      tabContent.innerHTML = '<div class="error">Error cargando contenido</div>';
    }
  }

  async loadLogs(logType) {
    try {
      const response = await fetch('/api/logs');
      if (response.ok) {
        const logFiles = await response.json();
        await this.renderLogFiles(logType, logFiles[logType] || []);
      } else {
        document.getElementById('tabContent').innerHTML =
          '<div class="error">Error cargando logs</div>';
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      document.getElementById('tabContent').innerHTML =
        '<div class="error">Error cargando logs</div>';
    }
  }

  async renderLogFiles(logType, files) {
    const tabContent = document.getElementById('tabContent');

    if (files.length === 0) {
      tabContent.innerHTML = `<div class="error">No hay logs de tipo ${logType}</div>`;
      return;
    }

    let html = '';
    if (logType === 'shield') {
      html +=
        '<div class="shield-warning show">⚠️ Los siguientes logs pueden contener contenido sensible u ofensivo.</div>';
    }

    for (const file of files.slice(0, 3)) {
      // Show only first 3 files
      try {
        const response = await fetch(`/api/logs/${logType}/${file}?lines=20`);
        if (response.ok) {
          const logData = await response.json();
          html += `
                        <h4>📄 ${file}</h4>
                        <div class="log-content">
                            ${this.formatLogContent(logData.content)}
                        </div>
                    `;
        }
      } catch (error) {
        console.error(`Error loading log file ${file}:`, error);
      }
    }

    tabContent.innerHTML = html;
  }

  formatLogContent(logEntries) {
    return logEntries
      .map((entry) => {
        if (entry.timestamp && entry.level) {
          return `<div>[${entry.timestamp}] ${entry.level}: ${entry.message}</div>`;
        } else {
          return `<div>${entry.raw || JSON.stringify(entry)}</div>`;
        }
      })
      .join('');
  }

  renderMetrics() {
    const tabContent = document.getElementById('tabContent');

    if (!this.metrics.global) {
      tabContent.innerHTML = '<div class="error">No hay métricas disponibles</div>';
      return;
    }

    const global = this.metrics.global;
    const platforms = this.metrics.integrations || {};

    let html = `
            <h4>📊 Métricas Globales</h4>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${global.totalCommentsProcessed}</div>
                    <div class="metric-label">Comentarios Procesados</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${global.totalResponsesGenerated}</div>
                    <div class="metric-label">Respuestas Generadas</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${global.totalErrors}</div>
                    <div class="metric-label">Errores</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round(global.uptime / 60)}</div>
                    <div class="metric-label">Minutos Activo</div>
                </div>
            </div>
        `;

    if (Object.keys(platforms).length > 0) {
      html += '<h4>📱 Métricas por Plataforma</h4>';
      Object.keys(platforms).forEach((platform) => {
        const metrics = platforms[platform];
        html += `
                    <h5>${this.getPlatformName(platform)}</h5>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value">${metrics.commentsProcessed || 0}</div>
                            <div class="metric-label">Comentarios</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${metrics.responsesGenerated || 0}</div>
                            <div class="metric-label">Respuestas</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${metrics.errorsEncountered || 0}</div>
                            <div class="metric-label">Errores</div>
                        </div>
                    </div>
                `;
      });
    }

    tabContent.innerHTML = html;
  }

  getPlatformIcon(platform) {
    const icons = {
      twitter: '🐦',
      youtube: '📺',
      bluesky: '☁️',
      instagram: '📸'
    };
    return icons[platform] || '🔗';
  }

  getPlatformName(platform) {
    const names = {
      twitter: 'Twitter/X',
      youtube: 'YouTube',
      bluesky: 'Bluesky',
      instagram: 'Instagram'
    };
    return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = type;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
}

// Initialize the panel when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new IntegrationPanel();
});
