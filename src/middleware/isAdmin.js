const { supabaseServiceClient, getUserFromToken } = require('../config/supabase');
const { logger } = require('../utils/logger');

/**
 * Middleware específico para el panel de administración
 * Valida que el usuario sea administrador con acceso completo
 */
const isAdminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Se requiere autenticación para acceder al panel de administración'
      });
    }

    // TEST MODE: Bypass authentication for integration tests
    if (process.env.NODE_ENV === 'test' && token === 'mock-admin-token-for-testing') {
      req.user = {
        id: '00000000-0000-0000-0000-000000000001', // Valid UUID for test mode
        email: 'admin@test.com',
        name: 'Test Admin',
        is_admin: true,
        active: true
      };
      req.accessToken = token;
      return next();
    }

    // Verificar token con Supabase
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Token inválido o expirado'
      });
    }

    // Verificar que el usuario sea admin en la base de datos
    const { data: userProfile, error: dbError } = await supabaseServiceClient
      .from('users')
      .select('id, email, name, is_admin, active')
      .eq('id', user.id)
      .single();

    if (dbError || !userProfile) {
      logger.error('Failed to fetch user admin status:', dbError?.message);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'No se pudo verificar el estado de administrador'
      });
    }

    // Verificar que sea admin y esté activo
    if (!userProfile.is_admin) {
      logger.warn('Non-admin user attempted to access admin panel:', {
        userId: user.id,
        email: userProfile.email
      });
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'Se requieren permisos de administrador para acceder a esta sección'
      });
    }

    if (!userProfile.active) {
      return res.status(403).json({
        success: false,
        error: 'Account inactive',
        message: 'Cuenta de administrador inactiva'
      });
    }

    // Añadir información del usuario a la request
    req.user = userProfile;
    req.accessToken = token;

    logger.info('Admin access granted:', { userId: userProfile.id, email: userProfile.email });
    next();
  } catch (error) {
    logger.error('Admin middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware opcional para rutas que pueden ser accedidas por admin o usuario normal
 */
const optionalAdminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await getUserFromToken(token);
      if (user) {
        const { data: userProfile } = await supabaseServiceClient
          .from('users')
          .select('id, email, name, is_admin, active')
          .eq('id', user.id)
          .single();

        if (userProfile && userProfile.active) {
          req.user = userProfile;
          req.accessToken = token;
          req.isAdmin = userProfile.is_admin;
        }
      }
    }

    next();
  } catch (error) {
    logger.warn('Optional admin middleware error:', error.message);
    next(); // Continuar sin autenticación
  }
};

module.exports = {
  isAdminMiddleware,
  optionalAdminMiddleware
};
