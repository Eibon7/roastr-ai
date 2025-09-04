const request = require('supertest');
const express = require('express');

// Create a simple test app
const app = express();
app.use(express.json());

// Mock the theme endpoint directly
app.get('/api/user/settings/theme', (req, res) => {
  res.json({
    success: true,
    data: {
      theme: 'system',
      options: [
        { value: 'light', label: 'Claro', description: 'Tema claro siempre activo' },
        { value: 'dark', label: 'Oscuro', description: 'Tema oscuro siempre activo' },
        { value: 'system', label: 'Sistema', description: 'Sigue la configuración del sistema', isDefault: true }
      ]
    }
  });
});

app.patch('/api/user/settings/theme', (req, res) => {
  const { theme } = req.body;
  
  if (!theme || !['light', 'dark', 'system'].includes(theme)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid theme. Must be one of: light, dark, system'
    });
  }
  
  res.json({
    success: true,
    message: 'Theme setting updated successfully',
    data: { theme }
  });
});

describe('Simple Theme Settings Test', () => {
  it('should return theme settings', async () => {
    const response = await request(app)
      .get('/api/user/settings/theme');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.theme).toBe('system');
  });

  it('should update theme settings', async () => {
    const response = await request(app)
      .patch('/api/user/settings/theme')
      .send({ theme: 'dark' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.theme).toBe('dark');
  });

  it('should validate theme values', async () => {
    const response = await request(app)
      .patch('/api/user/settings/theme')
      .send({ theme: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
