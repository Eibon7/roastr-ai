import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import UserDetail from '../pages/admin/UserDetail';

// Mock the necessary dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ userId: 'test-user-123' }),
  useNavigate: () => jest.fn()
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'fake-auth-token'),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('UserDetail Component - Issue #241', () => {
  const mockUserData = {
    data: {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'pro',
        active: true,
        suspended: false,
        is_admin: false,
        shield_enabled: true,
        auto_reply_enabled: false,
        tone: 'balanceado',
        persona_defines: 'Soy una persona sarcástica',
        persona_doesnt_tolerate: 'No tolero la grosería',
        persona_doesnt_care: 'Me da igual el clima',
        created_at: '2024-01-01T00:00:00Z',
        last_activity_at: '2024-01-15T12:00:00Z'
      },
      monthly_stats: {
        messages_sent: 50,
        tokens_consumed: 1000,
        activities_count: 25
      },
      plan_limits: {
        monthly_messages: 100,
        monthly_tokens: 5000
      },
      usage_alerts: [],
      is_over_limit: false,
      recent_activities: []
    }
  };

  const mockActivityData = {
    data: {
      user: { id: 'test-user-123', email: 'test@example.com' },
      recent_roasts: [
        {
          id: 'roast-1',
          original_comment: 'Este producto es terrible',
          roast_response: 'Pues mira, terrible es tu capacidad de dar feedback constructivo',
          platform: 'twitter',
          toxicity_score: 0.3,
          created_at: '2024-01-15T10:00:00Z'
        }
      ],
      shield_intercepts: [
        {
          id: 'shield-1',
          comment_text: 'Comentario muy tóxico',
          platform: 'youtube',
          toxicity_score: 0.9,
          action_taken: 'blocked',
          created_at: '2024-01-15T09:00:00Z'
        }
      ],
      integrations_status: [
        {
          platform: 'twitter',
          status: 'connected',
          handle: 'testuser',
          connected_at: '2024-01-01T00:00:00Z',
          last_sync_at: '2024-01-15T11:00:00Z'
        }
      ]
    }
  };

  beforeEach(() => {
    // Mock fetch responses
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        // Auth check
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { is_admin: true } })
        })
      )
      .mockImplementationOnce(() =>
        // User details
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserData)
        })
      )
      .mockImplementationOnce(() =>
        // User activity
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockActivityData)
        })
      );

    // Mock window.confirm and window.alert
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderUserDetail = () => {
    return render(
      <MemoryRouter initialEntries={['/admin/users/test-user-123']}>
        <UserDetail />
      </MemoryRouter>
    );
  };

  describe('Basic Component Structure', () => {
    test('should render superuser banner as required in issue #241', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText(/Vista de superusuario/)).toBeInTheDocument();
        expect(screen.getByText(/actuando sobre la cuenta de/)).toBeInTheDocument();
      });
    });

    test('should show user information section', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('PRO')).toBeInTheDocument();
      });
    });
  });

  describe('Editable Configurations - Issue #241 Requirements', () => {
    test('should render all editable configuration fields', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Configuraciones Editables')).toBeInTheDocument();

        // Plan dropdown
        expect(screen.getByDisplayValue('pro')).toBeInTheDocument();

        // Tone dropdown
        expect(screen.getByDisplayValue('balanceado')).toBeInTheDocument();

        // Shield checkbox
        const shieldCheckbox = screen.getByRole('checkbox', { name: /Shield/i });
        expect(shieldCheckbox).toBeChecked();

        // Auto-reply checkbox
        const autoReplyCheckbox = screen.getByRole('checkbox', { name: /Auto-reply/i });
        expect(autoReplyCheckbox).not.toBeChecked();
      });
    });

    test('should render Roastr Persona fields with data', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Soy una persona sarcástica')).toBeInTheDocument();
        expect(screen.getByDisplayValue('No tolero la grosería')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Me da igual el clima')).toBeInTheDocument();
      });
    });

    test('should have functional save and cancel buttons', async () => {
      renderUserDetail();

      await waitFor(() => {
        const saveButton = screen.getByText('Guardar Cambios');
        const cancelButton = screen.getByText('Cancelar');

        expect(saveButton).toBeInTheDocument();
        expect(cancelButton).toBeInTheDocument();
        expect(saveButton).not.toBeDisabled();
        expect(cancelButton).not.toBeDisabled();
      });
    });
  });

  describe('Activity Sections - Issue #241 Requirements', () => {
    test('should show recent roasts section', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Últimos Roasts Generados')).toBeInTheDocument();
        expect(screen.getByText('Este producto es terrible')).toBeInTheDocument();
        expect(
          screen.getByText('Pues mira, terrible es tu capacidad de dar feedback constructivo')
        ).toBeInTheDocument();
      });
    });

    test('should show shield intercepted comments section', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Comentarios Interceptados por Shield')).toBeInTheDocument();
        expect(screen.getByText('Comentario muy tóxico')).toBeInTheDocument();
        expect(screen.getByText('blocked')).toBeInTheDocument();
      });
    });

    test('should show integrations status section', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Estado de Integraciones')).toBeInTheDocument();
        expect(screen.getByText('twitter')).toBeInTheDocument();
        expect(screen.getByText('@testuser')).toBeInTheDocument();
        expect(screen.getByText('connected')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions - Issue #241 Requirements', () => {
    test('should render all quick action buttons', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Reset Password')).toBeInTheDocument();
        expect(screen.getByText('Re-auth Integraciones')).toBeInTheDocument();
        expect(screen.getByText('Suspender')).toBeInTheDocument();
        expect(screen.getByText('Eliminar Cuenta')).toBeInTheDocument();
      });
    });

    test('should handle configuration save', async () => {
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { is_admin: true } })
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockUserData)
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockActivityData)
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { user: mockUserData.data.user }
              })
          })
        );

      renderUserDetail();

      await waitFor(() => {
        const saveButton = screen.getByText('Guardar Cambios');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users/test-user-123/config',
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              Authorization: 'Bearer fake-auth-token',
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });
  });

  describe('Navigation and User Experience', () => {
    test('should have breadcrumb navigation back to users list', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Usuarios')).toBeInTheDocument();
        expect(screen.getByText('Detalles de Usuario')).toBeInTheDocument();
      });
    });

    test('should show usage statistics in cards format', async () => {
      renderUserDetail();

      await waitFor(() => {
        expect(screen.getByText('Mensajes Mensuales')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('de 100 límite')).toBeInTheDocument();

        expect(screen.getByText('Tokens Consumidos')).toBeInTheDocument();
        expect(screen.getByText('1000')).toBeInTheDocument();
        expect(screen.getByText('de 5000 límite')).toBeInTheDocument();
      });
    });
  });
});

describe('UserDetail Backend Integration - Issue #241', () => {
  test('should call all required backend endpoints', async () => {
    const mockFetch = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { is_admin: true } })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                user: { id: 'test-user-123', email: 'test@example.com' },
                monthly_stats: {},
                plan_limits: {},
                usage_alerts: [],
                recent_activities: []
              }
            })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                recent_roasts: [],
                shield_intercepts: [],
                integrations_status: []
              }
            })
        })
      );

    global.fetch = mockFetch;

    render(
      <MemoryRouter initialEntries={['/admin/users/test-user-123']}>
        <UserDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Verify all required API calls were made
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/admin/users/test-user-123',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/users/test-user-123/activity',
        expect.any(Object)
      );
    });
  });
});
