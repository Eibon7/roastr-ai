# Workers Dashboard E2E Tests - Evidence

## Issue #828: E2E Tests for Worker Monitoring Dashboard

### Tests Implementados

1. **Dashboard Load Tests**
   - ✅ Dashboard loads correctly
   - ✅ Worker status cards display
   - ✅ Queue status table renders
   - ✅ Summary cards with metrics

2. **Error Handling Tests**
   - ✅ Workers not initialized error state
   - ✅ API error handling

3. **Real-time Updates Tests**
   - ✅ Metrics update indicators

4. **Responsive Design Tests**
   - ✅ Mobile viewport (375x667)
   - ✅ Tablet viewport (768x1024)
   - ✅ Desktop viewport (1920x1080)

5. **Visual Regression Tests**
   - ✅ Screenshot with healthy workers
   - ✅ Screenshot with unhealthy workers
   - ✅ Screenshot of error state

### Screenshots

Los screenshots se capturan automáticamente durante la ejecución de los tests y se guardan en este directorio:
- `healthy-workers.png` - Dashboard con workers saludables
- `unhealthy-workers.png` - Dashboard con workers no saludables
- `error-state.png` - Dashboard en estado de error

### Mock Data

Los tests usan mocks de Playwright (`page.route()`) para simular las respuestas de la API sin requerir un backend real:

- `/api/workers/metrics` - Métricas de workers
- `/api/workers/queues/status` - Estado de colas

### Ejecución

```bash
cd admin-dashboard
npm run test:e2e -- workers-dashboard
```

### Notas

- Los tests no requieren backend real (usan mocks)
- Los screenshots se guardan automáticamente en `docs/test-evidence/workers-dashboard/`
- La ruta `/admin/workers` fue agregada a `App.tsx` para habilitar los tests

