#!/usr/bin/env node

/**
 * Script para configurar un usuario administrador en Roastr.ai
 * Uso: node scripts/setup-admin.js
 */

const { supabaseServiceClient } = require('../src/config/supabase');
const { logger } = require('../src/utils/logger');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function createAdminUser() {
    console.log('\n🔧 Configuración de Usuario Administrador - Roastr.ai\n');
    
    try {
        // Obtener datos del administrador
        const email = await question('📧 Email del administrador: ');
        const name = await question('👤 Nombre del administrador: ');
        const password = await question('🔒 Password temporal (opcional, se generará uno si está vacío): ');
        
        if (!email || !email.includes('@')) {
            console.error('❌ Email inválido');
            process.exit(1);
        }

        console.log('\n⏳ Creando usuario administrador...\n');

        // Generar password temporal si no se proporcionó
        const finalPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
        
        // Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabaseServiceClient.auth.admin.createUser({
            email: email,
            password: finalPassword,
            email_confirm: true,
            user_metadata: {
                name: name || null
            }
        });

        if (authError) {
            console.error('❌ Error creando usuario en Supabase Auth:', authError.message);
            
            // Si el usuario ya existe, intentar actualizarlo
            if (authError.message.includes('already exists') || authError.message.includes('already registered')) {
                console.log('👤 Usuario ya existe, intentando actualizar a administrador...');
                
                // Buscar usuario existente
                const { data: existingUsers, error: searchError } = await supabaseServiceClient.auth.admin.listUsers();
                
                if (searchError) {
                    console.error('❌ Error buscando usuarios:', searchError.message);
                    process.exit(1);
                }
                
                const existingUser = existingUsers.users.find(u => u.email === email);
                
                if (existingUser) {
                    // Actualizar usuario existente a admin
                    const { data: updatedUser, error: updateError } = await supabaseServiceClient
                        .from('users')
                        .update({ 
                            is_admin: true,
                            name: name || existingUser.user_metadata?.name,
                            active: true
                        })
                        .eq('id', existingUser.id)
                        .select()
                        .single();

                    if (updateError) {
                        console.error('❌ Error actualizando usuario a admin:', updateError.message);
                        process.exit(1);
                    }

                    console.log('✅ Usuario existente actualizado a administrador exitosamente');
                    console.log(`📧 Email: ${email}`);
                    console.log(`👤 Nombre: ${updatedUser.name || 'No especificado'}`);
                    console.log(`🔒 Password: Usa tu password actual`);
                } else {
                    console.error('❌ No se pudo encontrar el usuario existente');
                    process.exit(1);
                }
            } else {
                process.exit(1);
            }
        } else {
            // Usuario creado exitosamente
            console.log('✅ Usuario creado en Supabase Auth');

            // Crear registro en la tabla users
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: authData.user.email,
                    name: name || null,
                    plan: 'creator_plus', // Dar el plan más alto a los admins
                    is_admin: true,
                    active: true
                })
                .select()
                .single();

            if (userError) {
                console.error('❌ Error creando registro de usuario:', userError.message);
                
                // Limpiar usuario de Auth si falló la creación en la tabla
                await supabaseServiceClient.auth.admin.deleteUser(authData.user.id);
                process.exit(1);
            }

            console.log('✅ Usuario administrador creado exitosamente\n');
            console.log('📋 Detalles del administrador:');
            console.log(`📧 Email: ${email}`);
            console.log(`👤 Nombre: ${name || 'No especificado'}`);
            console.log(`🔒 Password temporal: ${finalPassword}`);
            console.log(`💼 Plan: creator_plus`);
            console.log(`🛡️ Admin: Sí\n`);
            
            console.log('🌐 Puedes acceder al panel de administración en:');
            console.log(`   http://localhost:3000/admin.html\n`);
            
            console.log('⚠️  IMPORTANTE:');
            console.log('   - Cambia el password temporal después del primer login');
            console.log('   - Guarda estas credenciales en un lugar seguro');
        }

        // Verificar que el usuario puede acceder al panel
        console.log('🔍 Verificando acceso de administrador...');
        
        const { data: verifyUser, error: verifyError } = await supabaseServiceClient
            .from('users')
            .select('email, name, is_admin, active, plan')
            .eq('email', email)
            .single();

        if (verifyError || !verifyUser) {
            console.error('❌ Error verificando usuario:', verifyError?.message);
        } else if (!verifyUser.is_admin) {
            console.error('❌ Usuario no tiene permisos de administrador');
        } else {
            console.log('✅ Verificación exitosa: Usuario tiene acceso de administrador\n');
        }

    } catch (error) {
        console.error('❌ Error inesperado:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function listAdmins() {
    console.log('\n👥 Usuarios administradores actuales:\n');
    
    try {
        const { data: admins, error } = await supabaseServiceClient
            .from('users')
            .select('email, name, active, created_at, last_activity_at')
            .eq('is_admin', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error obteniendo administradores:', error.message);
            return;
        }

        if (!admins || admins.length === 0) {
            console.log('📭 No hay usuarios administradores configurados');
            return;
        }

        console.log(`Encontrados ${admins.length} administrador(es):\n`);
        
        admins.forEach((admin, index) => {
            console.log(`${index + 1}. 📧 ${admin.email}`);
            console.log(`   👤 Nombre: ${admin.name || 'No especificado'}`);
            console.log(`   ${admin.active ? '✅' : '❌'} Estado: ${admin.active ? 'Activo' : 'Inactivo'}`);
            console.log(`   📅 Creado: ${new Date(admin.created_at).toLocaleDateString('es-ES')}`);
            console.log(`   🕐 Última actividad: ${admin.last_activity_at ? new Date(admin.last_activity_at).toLocaleDateString('es-ES') : 'Nunca'}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error inesperado:', error.message);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--list') || args.includes('-l')) {
        await listAdmins();
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        console.log('\n🔧 Setup Admin - Roastr.ai\n');
        console.log('Uso:');
        console.log('  node scripts/setup-admin.js          Crear nuevo administrador');
        console.log('  node scripts/setup-admin.js --list   Listar administradores');
        console.log('  node scripts/setup-admin.js --help   Mostrar esta ayuda\n');
        return;
    }

    await createAdminUser();
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().then(() => {
        console.log('🎉 Proceso completado');
        process.exit(0);
    }).catch((error) => {
        console.error('💥 Error fatal:', error.message);
        process.exit(1);
    });
}

module.exports = { createAdminUser, listAdmins };