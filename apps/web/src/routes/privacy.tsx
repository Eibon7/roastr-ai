export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Última actualización: marzo 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Datos que recopilamos</h2>
            <p className="mt-2 text-muted-foreground">
              Roastr recopila únicamente los datos necesarios para prestar el servicio: dirección de
              correo electrónico, credenciales de acceso OAuth a plataformas conectadas y registros de
              actividad del Shield (sin almacenar el texto de comentarios individuales).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Uso de los datos</h2>
            <p className="mt-2 text-muted-foreground">
              Los datos se usan exclusivamente para operar y mejorar el servicio. No vendemos ni
              compartimos información personal con terceros salvo obligación legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Retención de datos</h2>
            <p className="mt-2 text-muted-foreground">
              Los registros de actividad del Shield y los candidatos a roast se eliminan automáticamente
              transcurridos 90 días. Los registros de infractores se anonimizan (el identificador se
              reemplaza por un hash irreversible) conservando únicamente las estadísticas agregadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Tus derechos (GDPR)</h2>
            <p className="mt-2 text-muted-foreground">
              Tienes derecho de acceso, rectificación, portabilidad y supresión de tus datos. Puedes
              eliminar tu cuenta en cualquier momento desde{" "}
              <strong>Ajustes → Cuenta → Eliminar cuenta</strong>. Todos tus datos personales se
              borrarán de forma permanente e irreversible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Seguridad</h2>
            <p className="mt-2 text-muted-foreground">
              Los tokens OAuth se almacenan cifrados. Utilizamos Supabase con Row Level Security para
              garantizar que cada usuario solo accede a sus propios datos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Contacto</h2>
            <p className="mt-2 text-muted-foreground">
              Para cualquier consulta sobre privacidad escríbenos a{" "}
              <a href="mailto:privacy@roastr.ai" className="text-primary underline">
                privacy@roastr.ai
              </a>
              . Consulta también nuestros{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">
                Términos de Servicio
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
