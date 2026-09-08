# Matías — 2026-09-07

- [x] Análisis: por qué gente que llenó el formulario de membresía de Yolanda Orellana Cárdenas no aparecía en su reporte de CdP -- causa real: lidera 2 Casas de Paz distintas, tenía activa la que no tiene sublíderes ni las 3 personas nuevas
- [x] Nueva sección "Personas" para Líder de CdP (roster de solo lectura de su propia Casa de Paz) -- deployado
- [x] Ciclo automático de estado SIM/NC/CRE para "Asistentes Nuevos": varias iteraciones hasta ajustarlo al spec formal del owner -- criterio configurable reusado (`VISITAS_PARA_CRE`, Panel de Supervisor → Estados SSVA), SIM automático al registrar, NC↔SIM por inasistencia, CRE definitivo, sin tocar a quienes vienen por Membresía
- [x] "Asistencia Regular" y "Personas" ahora incluyen a estas visitas NC/Creyente (Personas también SIM) sin crear membresía formal
- [x] 3 bugs reales encontrados y corregidos en vivo: (1) diálogo manual de miembro regular se sacó pero se llevó puesta la única invalidación de caché de "Asistencia regular" -- agregada de nuevo en el lugar correcto; (2) Creyente había quedado "congelado" por decisión verbal previa, el spec formal del owner pedía lo contrario -- revertido; (3) el conteo de asistencias comparaba fecha de reunión en vez de fecha real de guardado del reporte -- reportes atrasados nunca sumaban, corregido a fecha_creacion
- [x] Deploy de trabajo de Gonzalo (módulo Departamento de Evangelismo, KAN-281 a 345) ya mergeado a master -- desplegado a producción
- [ ] Falta: tickets de Jira de todo lo de hoy (OAuth de Atlassian sigue sin completarse)
- [ ] Falta: confirmar en vivo con el owner que el flujo SIM→NC→CRE se ve como espera en la pantalla del reporte real (no solo verificado por SQL)
