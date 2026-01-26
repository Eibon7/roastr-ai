import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * PrivacyPage
 *
 * Política de Privacidad de Roastr.AI
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/login">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Política de Privacidad</CardTitle>
            <p className="text-sm text-muted-foreground">Última actualización: Enero 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Información que Recopilamos</h2>
              <p>
                En Roastr.AI recopilamos la siguiente información cuando utilizas nuestro servicio:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Información de cuenta:</strong> email, contraseña (encriptada)</li>
                <li><strong>Información de uso:</strong> comentarios analizados, respuestas generadas, configuración de tono</li>
                <li><strong>Información técnica:</strong> dirección IP, tipo de navegador, datos de acceso</li>
                <li><strong>Información de redes sociales:</strong> tokens de acceso (cuando conectas tus cuentas)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Cómo Utilizamos tu Información</h2>
              <p>Utilizamos la información recopilada para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Proporcionar y mejorar nuestro servicio de análisis y moderación de comentarios</li>
                <li>Personalizar tu experiencia con diferentes tonos y estilos de respuesta</li>
                <li>Procesar tus pagos y gestionar tu suscripción</li>
                <li>Enviarte notificaciones importantes sobre tu cuenta y el servicio</li>
                <li>Detectar y prevenir fraudes o usos indebidos del servicio</li>
                <li>Cumplir con obligaciones legales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Compartir Información</h2>
              <p>
                No vendemos tu información personal. Podemos compartir tu información únicamente en los siguientes casos:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Proveedores de servicios:</strong> servicios de hosting, procesamiento de pagos, análisis</li>
                <li><strong>APIs de IA:</strong> OpenAI para generar respuestas (sin almacenar datos identificables)</li>
                <li><strong>Cumplimiento legal:</strong> cuando sea requerido por ley o para proteger nuestros derechos</li>
                <li><strong>Transferencia de negocio:</strong> en caso de fusión, adquisición o venta de activos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Protección de Datos</h2>
              <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encriptación de contraseñas y datos sensibles</li>
                <li>Conexiones seguras HTTPS</li>
                <li>Control de acceso basado en roles (RBAC)</li>
                <li>Auditorías de seguridad regulares</li>
                <li>Copias de seguridad periódicas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Tus Derechos (GDPR)</h2>
              <p>
                De acuerdo con el Reglamento General de Protección de Datos (GDPR), tienes derecho a:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Acceso:</strong> solicitar una copia de tus datos personales</li>
                <li><strong>Rectificación:</strong> corregir datos incorrectos o incompletos</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de tus datos ("derecho al olvido")</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado</li>
                <li><strong>Oposición:</strong> oponerte a ciertos procesamientos de tus datos</li>
                <li><strong>Limitación:</strong> solicitar la restricción del procesamiento</li>
              </ul>
              <p className="mt-3">
                Para ejercer cualquiera de estos derechos, contáctanos a través de nuestro sitio web.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Retención de Datos</h2>
              <p>
                Conservamos tu información personal mientras tu cuenta esté activa o según sea necesario para 
                proporcionarte servicios. Eliminaremos tus datos:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Cuando canceles tu cuenta (salvo obligaciones legales de conservación)</li>
                <li>Después de 30 días desde la solicitud de eliminación</li>
                <li>Según lo requieran las leyes aplicables de protección de datos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cookies y Tecnologías Similares</h2>
              <p>Utilizamos cookies y tecnologías similares para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Mantener tu sesión activa</li>
                <li>Recordar tus preferencias</li>
                <li>Analizar el uso del servicio y mejorar la experiencia</li>
                <li>Proporcionar funcionalidades de seguridad</li>
              </ul>
              <p className="mt-3">
                Puedes configurar tu navegador para rechazar cookies, aunque esto puede afectar 
                la funcionalidad del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Servicios de Terceros</h2>
              <p>Nuestro servicio puede contener enlaces a sitios web de terceros. No somos responsables 
              de las prácticas de privacidad de estos sitios. Te recomendamos leer sus políticas de privacidad.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Privacidad de Menores</h2>
              <p>
                Nuestro servicio no está dirigido a menores de 16 años. No recopilamos intencionalmente 
                información de menores. Si descubrimos que hemos recopilado datos de un menor, los 
                eliminaremos inmediatamente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Transferencias Internacionales</h2>
              <p>
                Tus datos pueden ser transferidos y procesados en servidores ubicados fuera de la Unión Europea. 
                Nos aseguramos de que estas transferencias cumplan con los requisitos del GDPR mediante 
                cláusulas contractuales estándar.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Cambios a esta Política</h2>
              <p>
                Podemos actualizar esta Política de Privacidad periódicamente. Te notificaremos sobre 
                cambios significativos publicando la nueva política en esta página y actualizando la 
                fecha de "Última actualización".
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contacto</h2>
              <p>
                Si tienes preguntas sobre esta Política de Privacidad o sobre cómo manejamos tus datos, 
                por favor contáctanos a través de nuestro sitio web.
              </p>
            </section>

            <div className="pt-6 mt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Al utilizar Roastr.AI, confirmas que has leído y entendido esta Política de Privacidad, 
                así como nuestros{' '}
                <Link to="/terms" className="underline hover:text-primary">
                  Términos y Condiciones
                </Link>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
