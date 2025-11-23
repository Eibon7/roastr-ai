// Admin Panel JavaScript - Roastr.ai
class AdminPanel {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.currentUser = null;
    this.currentSection = 'dashboard';

    this.init();
  }

  init() {
    if (!this.token) {
      this.redirectToLogin();
      return;
    }

    this.bindEvents();
    this.verifyAdmin();
    this.loadDashboard();
  }

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const section = e.target.closest('.nav-btn').dataset.section;
        this.switchSection(section);
      });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });

    // Dashboard refresh
    document.getElementById('refresh-dashboard')?.addEventListener('click', () => {
      this.loadDashboard();
    });

    // Users section
    document.getElementById('refresh-users')?.addEventListener('click', () => {
      this.loadUsers();
    });

    document.getElementById('user-search')?.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.loadUsers();
      }, 500);
    });

    document.getElementById('user-filter')?.addEventListener('change', () => {
      this.loadUsers();
    });

    // Integration test
    document.getElementById('run-integration-test')?.addEventListener('click', () => {
      this.runIntegrationTest();
    });

    // Config refresh
    document.getElementById('refresh-config')?.addEventListener('click', () => {
      this.loadConfig();
    });

    // Logs section
    document.getElementById('refresh-logs')?.addEventListener('click', () => {
      this.loadLogs();
    });

    document.getElementById('log-filter')?.addEventListener('change', () => {
      this.loadLogs();
    });

    document.getElementById('download-logs')?.addEventListener('click', () => {
      this.downloadLogs();
    });
  }

  async verifyAdmin() {
    try {
      const response = await this.apiCall('/api/auth/me');
      if (response.success && response.data.is_admin) {
        this.currentUser = response.data;
        document.getElementById('admin-name').textContent =
          this.currentUser.name || this.currentUser.email;
      } else {
        this.showAccessDenied();
      }
    } catch (error) {
      console.error('Admin verification failed:', error);
      this.redirectToLogin();
    }
  }

  switchSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Update sections
    document.querySelectorAll('.admin-section').forEach((sec) => {
      sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');

    this.currentSection = section;

    // Load section data
    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'integrations':
        // Integration section is mostly static
        break;
      case 'config':
        this.loadConfig();
        break;
      case 'logs':
        this.loadLogs();
        break;
    }
  }

  async loadDashboard() {
    this.showLoading(true);

    try {
      const response = await this.apiCall('/api/admin/dashboard');

      if (response.success) {
        const data = response.data;

        // Update basic stats with new format
        document.getElementById('total-users').textContent = data.users.total;
        document.getElementById('suspended-users').textContent =
          `${data.users.suspended} suspendidos`;

        // Update roast stats
        document.getElementById('total-roasts').textContent = data.roasts.total;
        document.getElementById('roasts-today').textContent = `${data.roasts.today} hoy`;

        // Update weekly activity
        document.getElementById('weekly-activity').textContent = data.roasts.this_week;
        document.getElementById('weekly-details').textContent =
          `roasts, ${data.users.new_this_week} nuevos usuarios`;

        // Update integrations count
        document.getElementById('active-integrations-count').textContent =
          data.integrations.stats.active;
        document.getElementById('integrations-status').textContent =
          `de ${data.integrations.stats.total} activas`;

        // Update top users ranking
        this.renderTopUsers(data.topUsers);

        // Update integrations status
        this.renderIntegrationsStatus(data.integrations);

        // Update most active integrations chart
        this.renderMostActiveIntegrations(data.roasts, data.integrations);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      this.showToast('Error cargando dashboard', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  renderTopUsers(topUsers) {
    const container = document.getElementById('top-users');

    if (!topUsers || topUsers.length === 0) {
      container.innerHTML = '<p class="text-secondary">No hay datos de usuarios disponibles</p>';
      return;
    }

    const rankingHtml = topUsers
      .map((user, index) => {
        const position = index + 1;
        let positionClass = '';
        if (position === 1) positionClass = 'gold';
        else if (position === 2) positionClass = 'silver';
        else if (position === 3) positionClass = 'bronze';

        return `
                <div class="ranking-item">
                    <div class="ranking-position ${positionClass}">${position}</div>
                    <div class="ranking-info">
                        <div class="ranking-name">${user.name}</div>
                        <div class="ranking-email">${user.email}</div>
                    </div>
                    <div class="ranking-stats">
                        <div class="ranking-total">${user.total_roasts}</div>
                        <div class="ranking-monthly">${user.monthly_roasts} este mes</div>
                    </div>
                </div>
            `;
      })
      .join('');

    container.innerHTML = rankingHtml;
  }

  renderIntegrationsStatus(integrationsData) {
    const container = document.getElementById('integrations-status-list');

    if (!integrationsData || !integrationsData.integrations) {
      container.innerHTML =
        '<p class="text-secondary">No hay datos de integraciones disponibles</p>';
      return;
    }

    const integrations = integrationsData.integrations;
    const statusHtml = integrations
      .map((integration) => {
        const lastRun = integration.last_executed
          ? this.formatDate(integration.last_executed)
          : 'Nunca ejecutada';

        return `
                <div class="integration-status-item">
                    <div class="integration-icon">
                        <i class="${integration.icon}"></i>
                    </div>
                    <div class="integration-details">
                        <div class="integration-name">${integration.name}</div>
                        <div class="integration-last-run">Última ejecución: ${lastRun}</div>
                    </div>
                    <div class="integration-status-badge ${integration.status}">
                        ${this.getStatusText(integration.status)}
                    </div>
                </div>
            `;
      })
      .join('');

    container.innerHTML = statusHtml;
  }

  renderMostActiveIntegrations(roastsData, integrationsData) {
    const container = document.getElementById('most-active-integrations');

    // Simular actividad por plataforma basada en integraciones activas
    const activeIntegrations = integrationsData.integrations
      .filter((i) => i.status === 'active')
      .slice(0, 5);

    if (activeIntegrations.length === 0) {
      container.innerHTML = '<p class="text-secondary">No hay integraciones activas</p>';
      return;
    }

    // Simular conteos de actividad
    const maxCount = Math.max(100, roastsData.this_month / activeIntegrations.length);

    const chartHtml = activeIntegrations
      .map((integration, index) => {
        const count = Math.floor(maxCount * (1 - index * 0.15));
        const percentage = (count / maxCount) * 100;

        return `
                <div class="activity-chart-item">
                    <div class="activity-chart-name">${integration.name}</div>
                    <div class="activity-chart-bar">
                        <div class="activity-chart-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="activity-chart-count">${count}</div>
                </div>
            `;
      })
      .join('');

    container.innerHTML = chartHtml;
  }

  getStatusText(status) {
    const texts = {
      active: 'Activa',
      configured: 'Configurada',
      disabled: 'Deshabilitada'
    };
    return texts[status] || status;
  }

  async loadUsers() {
    const search = document.getElementById('user-search')?.value || '';
    const filter = document.getElementById('user-filter')?.value || '';

    try {
      const params = new URLSearchParams({
        limit: 50,
        offset: 0,
        search: search
      });

      if (filter === 'admin') {
        params.append('admin_only', 'true');
      } else if (filter === 'active') {
        params.append('active_only', 'true');
      }

      const response = await this.apiCall(`/api/admin/users?${params.toString()}`);

      if (response.success) {
        this.renderUsersTable(response.data.users);
      }
    } catch (error) {
      console.error('Users load error:', error);
      this.showToast('Error cargando usuarios', 'error');
    }
  }

  renderUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');

    if (!users || users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center">No se encontraron usuarios</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map((user) => {
        let statusBadge = '';
        if (user.suspended) {
          statusBadge = '<span class="badge suspended">Suspendido</span>';
        } else if (user.active) {
          statusBadge = '<span class="badge active">Activo</span>';
        } else {
          statusBadge = '<span class="badge inactive">Inactivo</span>';
        }

        return `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.name || '-'}</td>
                    <td><span class="badge ${user.plan}">${user.plan}</span></td>
                    <td>${user.is_admin ? '<span class="badge admin">Admin</span>' : '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${this.formatDate(user.created_at)}</td>
                    <td>${user.last_activity_at ? this.formatDate(user.last_activity_at) : 'Nunca'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-warning" onclick="adminPanel.toggleAdmin('${user.id}', ${user.is_admin})">
                                ${user.is_admin ? 'Quitar Admin' : 'Hacer Admin'}
                            </button>
                            <button class="btn btn-sm ${user.active ? 'btn-error' : 'btn-success'}" onclick="adminPanel.toggleActive('${user.id}', ${user.active})">
                                ${user.active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button class="btn btn-sm ${user.suspended ? 'btn-success' : 'btn-warning'}" onclick="adminPanel.${user.suspended ? 'reactivateUser' : 'suspendUser'}('${user.id}')">
                                ${user.suspended ? 'Reactivar' : 'Suspender'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join('');
  }

  async toggleAdmin(userId, currentStatus) {
    const action = currentStatus ? 'remover de administrador' : 'hacer administrador';

    if (!confirm(`¿Estás seguro de que quieres ${action} a este usuario?`)) {
      return;
    }

    try {
      const response = await this.apiCall(`/api/admin/users/${userId}/toggle-admin`, 'POST');

      if (response.success) {
        this.showToast(response.data.message, 'success');
        this.loadUsers();
      }
    } catch (error) {
      console.error('Toggle admin error:', error);
      this.showToast('Error al cambiar estado de administrador', 'error');
    }
  }

  async toggleActive(userId, currentStatus) {
    const action = currentStatus ? 'desactivar' : 'activar';

    if (!confirm(`¿Estás seguro de que quieres ${action} a este usuario?`)) {
      return;
    }

    try {
      const response = await this.apiCall(`/api/admin/users/${userId}/toggle-active`, 'POST');

      if (response.success) {
        this.showToast(response.data.message, 'success');
        this.loadUsers();
      }
    } catch (error) {
      console.error('Toggle active error:', error);
      this.showToast('Error al cambiar estado activo', 'error');
    }
  }

  async runIntegrationTest() {
    const platforms = document.getElementById('test-platforms')?.value?.trim() || '';
    const outputEl = document.getElementById('test-output');

    if (!outputEl) return;

    // Show loading state
    outputEl.innerHTML = '<p class="placeholder">Ejecutando test de integraciones...</p>';
    document.getElementById('run-integration-test').disabled = true;

    try {
      const response = await this.apiCall('/api/admin/integrations/test', 'POST', {
        platforms: platforms
      });

      if (response.success) {
        outputEl.textContent = response.data.output;
        this.showToast('Test de integraciones completado', 'success');
      } else {
        outputEl.textContent = `Error ejecutando test:\n${response.output || response.error}`;
        this.showToast('Error en test de integraciones', 'error');
      }
    } catch (error) {
      console.error('Integration test error:', error);
      outputEl.textContent = `Error de conexión:\n${error.message}`;
      this.showToast('Error ejecutando test', 'error');
    } finally {
      document.getElementById('run-integration-test').disabled = false;
    }
  }

  async loadConfig() {
    try {
      const response = await this.apiCall('/api/admin/config');

      if (response.success) {
        this.renderConfig(response.data);
      }
    } catch (error) {
      console.error('Config load error:', error);
      this.showToast('Error cargando configuración', 'error');
    }
  }

  renderConfig(data) {
    // Integration config
    const integrationEl = document.getElementById('integration-config');
    if (data.env_config.integrations) {
      const integrations = data.env_config.integrations;
      integrationEl.innerHTML = Object.entries(integrations)
        .map(
          ([key, value]) => `
                    <div class="config-item">
                        <span class="config-key">${key}</span>
                        <span class="config-value">${value}</span>
                    </div>
                `
        )
        .join('');
    }

    // Feature config
    const featureEl = document.getElementById('feature-config');
    if (data.env_config.features) {
      const features = data.env_config.features;
      featureEl.innerHTML = Object.entries(features)
        .map(
          ([key, value]) => `
                    <div class="config-item">
                        <span class="config-key">${key}</span>
                        <span class="config-value">${value}</span>
                    </div>
                `
        )
        .join('');
    }

    // Limits config
    const limitsEl = document.getElementById('limits-config');
    if (data.env_config.limits) {
      const limits = data.env_config.limits;
      limitsEl.innerHTML = Object.entries(limits)
        .map(
          ([key, value]) => `
                    <div class="config-item">
                        <span class="config-key">${key}</span>
                        <span class="config-value">${value}</span>
                    </div>
                `
        )
        .join('');
    }
  }

  async loadLogs() {
    const filter = document.getElementById('log-filter')?.value || 'all';

    try {
      const response = await this.apiCall(`/api/admin/logs?type=${filter}&limit=100`);

      if (response.success) {
        this.renderLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Logs load error:', error);
      this.showToast('Error cargando logs', 'error');
    }
  }

  renderLogs(logs) {
    const logsEl = document.getElementById('logs-content');

    if (!logs || logs.length === 0) {
      logsEl.innerHTML = '<p class="placeholder">No hay logs disponibles</p>';
      return;
    }

    const logText = logs
      .map((log) => {
        const time = this.formatDate(log.created_at);
        const level = log.level.toUpperCase();
        const category = log.category;
        const platform = log.platform ? `[${log.platform}]` : '';
        const message = log.message;

        return `[${time}] [${level}] [${category}] ${platform} ${message}`;
      })
      .join('\n');

    logsEl.textContent = logText;
  }

  async downloadLogs() {
    try {
      const response = await fetch('/api/admin/logs/download', {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roastr-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('Logs descargados exitosamente', 'success');
      } else {
        throw new Error('Error descargando logs');
      }
    } catch (error) {
      console.error('Download logs error:', error);
      this.showToast('Error descargando logs', 'error');
    }
  }

  // Utility methods
  async apiCall(endpoint, method = 'GET', body = null) {
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json();
      if (errorData.error === 'Admin access required') {
        this.showAccessDenied();
        throw new Error('Admin access required');
      } else {
        this.redirectToLogin();
        throw new Error('Authentication required');
      }
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'API call failed');
    }

    return await response.json();
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas ${
                  type === 'success'
                    ? 'fa-check-circle'
                    : type === 'error'
                      ? 'fa-exclamation-circle'
                      : type === 'warning'
                        ? 'fa-exclamation-triangle'
                        : 'fa-info-circle'
                }"></i>
                <span>${message}</span>
            </div>
        `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  redirectToLogin() {
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
  }

  showAccessDenied() {
    document.body.innerHTML = `
            <div class="admin-container" style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">
                <div style="text-align: center; padding: 40px; background: var(--card-background); border-radius: 8px; border: 1px solid var(--border-color);">
                    <i class="fas fa-shield-alt" style="font-size: 4rem; color: var(--error-color); margin-bottom: 20px;"></i>
                    <h1 style="color: var(--text-primary); margin-bottom: 10px;">Acceso Denegado</h1>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Se requieren permisos de administrador para acceder a esta sección.
                    </p>
                    <button onclick="window.location.href='/dashboard.html'" class="btn btn-primary">
                        <i class="fas fa-arrow-left"></i> Volver al Dashboard
                    </button>
                </div>
            </div>
        `;
  }

  async suspendUser(userId) {
    const reason = prompt('Motivo de suspensión (opcional):');

    if (
      confirm(
        '¿Estás seguro de que quieres suspender a este usuario? No podrá generar roasts pero mantendrá acceso al dashboard.'
      )
    ) {
      try {
        const response = await this.apiCall(`/api/admin/users/${userId}/suspend`, 'POST', {
          reason: reason || null
        });

        if (response.success) {
          this.showToast('Usuario suspendido exitosamente', 'success');
          this.loadUsers();
        }
      } catch (error) {
        console.error('Suspend user error:', error);
        this.showToast('Error al suspender usuario', 'error');
      }
    }
  }

  async reactivateUser(userId) {
    if (confirm('¿Estás seguro de que quieres reactivar a este usuario?')) {
      try {
        const response = await this.apiCall(`/api/admin/users/${userId}/reactivate`, 'POST');

        if (response.success) {
          this.showToast('Usuario reactivado exitosamente', 'success');
          this.loadUsers();
        }
      } catch (error) {
        console.error('Reactivate user error:', error);
        this.showToast('Error al reactivar usuario', 'error');
      }
    }
  }

  logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
  }
}

// Initialize admin panel when page loads
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
  adminPanel = new AdminPanel();
});
