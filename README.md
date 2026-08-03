# Registro de Horas Extra

App web (PWA) minimalista para registrar la jornada laboral diaria (entrada, salida y horas adicionales) y descargar un reporte en Excel, evitando que las horas extra queden sin pagar.

## Funcionalidad

- Configuración inicial del horario laboral por día de la semana.
- Botones de **Entrada**, **Salida** y **Hora adicional** (suma 1 hora fija al total del día).
- Cálculo automático de horas trabajadas por día y acumulado en el historial.
- Edición manual de registros pasados.
- Exportación y descarga directa del reporte en Excel (.xlsx).
- Funciona offline y es instalable en el celular (PWA).
- Todos los datos se guardan solo en el dispositivo (localStorage), sin backend ni cuentas.

## Uso

Abre `index.html` en un servidor HTTPS (por ejemplo, GitHub Pages) desde el navegador del celular y usa la opción "Agregar a pantalla de inicio" / "Instalar app".

## Desarrollo local

Requiere servir los archivos por HTTP (no `file://`) para que el service worker funcione. Ejemplo con el script incluido:

```
powershell -File serve.ps1
```

Luego abre `http://localhost:8791`.
