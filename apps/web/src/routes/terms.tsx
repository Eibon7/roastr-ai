export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Última actualización: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Aceptación</h2>
            <p className="mt-2 text-muted-foreground">
              Al utilizar Roastr aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Descripción del servicio</h2>
            <p className="mt-2 text-muted-foreground">
              Roastr es una herramienta de moderación y respuesta automática para creadores de
              contenido. Utiliza inteligencia artificial para analizar comentarios y generar respuestas.
              Toda respuesta generada por IA es claramente identificada como tal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Uso aceptable</h2>
            <p className="mt-2 text-muted-foreground">
              No puedes usar Roastr para acosar, difamar, discriminar ni para actividades ilegales.
              Eres responsable del uso que haces de las respuestas generadas antes de publicarlas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Divulgación de IA</h2>
            <p className="mt-2 text-muted-foreground">
              Todas las respuestas publicadas a través de Roastr incluyen una indicación visible de
              que han sido generadas con asistencia de IA, cumpliendo con los términos de servicio de
              las plataformas conectadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Suscripciones y pagos</h2>
            <p className="mt-2 text-muted-foreground">
              Los planes de pago se facturan mensualmente a través de Polar. Puedes cancelar en
              cualquier momento. No se realizan reembolsos por períodos parciales salvo obligación
              legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Limitación de responsabilidad</h2>
            <p className="mt-2 text-muted-foreground">
              Roastr se proporciona "tal cual". No garantizamos la exactitud de las respuestas
              generadas por IA. No somos responsables de las consecuencias de publicar contenido
              generado sin revisión previa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Contacto</h2>
            <p className="mt-2 text-muted-foreground">
              Para consultas legales escríbenos a{" "}
              <a href="mailto:legal@roastr.ai" className="text-primary underline">
                legal@roastr.ai
              </a>
              . Consulta también nuestra{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">
                Política de Privacidad
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
