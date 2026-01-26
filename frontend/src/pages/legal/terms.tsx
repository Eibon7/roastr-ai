import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * TermsPage
 *
 * Términos y Condiciones de Roastr.AI
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" className="mb-6" asChild>
          <Link to="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Términos y Condiciones</CardTitle>
            <p className="text-sm text-muted-foreground">Última actualización: Enero 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar Roastr.AI ("el Servicio"), aceptas estar sujeto a estos Términos y Condiciones. 
                Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestro servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Descripción del Servicio</h2>
              <p>
                Roastr.AI es una plataforma que utiliza inteligencia artificial para analizar y moderar 
                comentarios en redes sociales, proporcionando respuestas automáticas con diferentes tonos 
                y estilos.
              </p>
              <p className="mt-3">
                <strong>Funcionalidades principales:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Análisis automático de comentarios con detección de toxicidad (Shield)</li>
                <li>Generación de respuestas personalizadas con IA en múltiples tonos</li>
                <li>Integración con plataformas: Twitter/X, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky</li>
                <li>Sistema de moderación automática basado en reglas personalizables</li>
                <li>Dashboard de métricas y análisis de engagement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Cuenta de Usuario</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Debes proporcionar información precisa y actualizada al registrarte.</li>
                <li>Eres responsable de mantener la confidencialidad de tu contraseña.</li>
                <li>Eres responsable de todas las actividades que ocurran bajo tu cuenta.</li>
                <li>Debes notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Uso Aceptable</h2>
              <p>Te comprometes a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Utilizar el servicio de manera legal y conforme a estos términos.</li>
                <li>No utilizar el servicio para fines maliciosos, spam o actividades ilegales.</li>
                <li>No intentar acceder a áreas restringidas del sistema.</li>
                <li>No interferir con el funcionamiento normal del servicio.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Contenido Generado</h2>
              <p>
                El contenido generado por la inteligencia artificial de Roastr.AI se proporciona "tal cual". 
                Aunque nos esforzamos por garantizar la calidad y precisión, no nos hacemos responsables del 
                contenido específico generado por la IA.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Planes y Pagos</h2>
              <p>Roastr.AI ofrece diferentes planes de suscripción para adaptarse a tus necesidades:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li><strong>Plan Gratuito:</strong> Acceso limitado para probar el servicio</li>
                <li><strong>Plan Starter:</strong> Ideal para usuarios individuales y pequeños proyectos</li>
                <li><strong>Plan Pro:</strong> Para profesionales con mayor volumen de comentarios</li>
                <li><strong>Plan Plus:</strong> Para equipos y uso intensivo</li>
              </ul>
              <p className="mt-3">Condiciones de pago:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Los planes de suscripción se cobran mensualmente según el plan seleccionado.</li>
                <li>Puedes cancelar tu suscripción en cualquier momento desde tu panel de usuario.</li>
                <li>No ofrecemos reembolsos por periodos de suscripción parcialmente utilizados.</li>
                <li>Nos reservamos el derecho de modificar los precios con previo aviso de 30 días.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Propiedad Intelectual</h2>
              <p>
                Todo el contenido del servicio, incluyendo texto, gráficos, logos, y software, es propiedad 
                de Roastr.AI o sus licenciantes y está protegido por las leyes de propiedad intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Limitación de Responsabilidad</h2>
              <p>
                Roastr.AI no será responsable de daños indirectos, incidentales, especiales o consecuentes 
                que resulten del uso o la imposibilidad de uso del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Modificaciones del Servicio</h2>
              <p>
                Nos reservamos el derecho de modificar, suspender o discontinuar el servicio (o cualquier 
                parte del mismo) en cualquier momento, con o sin previo aviso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Terminación</h2>
              <p>
                Podemos terminar o suspender tu cuenta inmediatamente, sin previo aviso, si consideramos 
                que has violado estos Términos y Condiciones.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Ley Aplicable</h2>
              <p>
                Estos términos se regirán e interpretarán de acuerdo con las leyes de España, 
                sin tener en cuenta sus disposiciones sobre conflictos de leyes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contacto</h2>
              <p>
                Si tienes preguntas sobre estos Términos y Condiciones, puedes contactarnos:
              </p>
              <ul className="list-none space-y-2 mt-4">
                <li><strong>Email:</strong> legal@roastr.ai</li>
                <li><strong>Sitio web:</strong> <a href="https://roastr.ai" className="underline hover:text-primary" target="_blank" rel="noreferrer">roastr.ai</a></li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Nos esforzamos por responder a todas las consultas en un plazo de 48 horas hábiles.
              </p>
            </section>

            <div className="pt-6 mt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Al utilizar Roastr.AI, confirmas que has leído, entendido y aceptado estos Términos y Condiciones, 
                así como nuestra{' '}
                <Link to="/privacy" className="underline hover:text-primary">
                  Política de Privacidad
                </Link>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
