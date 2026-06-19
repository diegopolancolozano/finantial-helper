# 1. Contexto del ejercicio
Eres parte del equipo de ingeniería de una fintech colombiana. Se te pide construir el módulo 
de gestión de movimientos financieros personales de un producto en etapa MVP. El módulo 
debe ser seguro, escalable y estar construido con las prácticas de ingeniería que se esperan en un equipo de producto financiero real.
No es un prototipo: el código debe estar listo para revisión de pares, pasar análisis de calidad 
automatizado y poder desplegarse. Las decisiones de arquitectura y stack tecnológico son 
parte de la evaluación.
# 2. Requerimientos funcionales
El desarrollo está dividido en tres módulos. Todos son obligatorios para aprobar la prueba.
Módulo 1 — Autenticación y gestión de sesión
 - Como usuario, quiero registrarme con correo y contraseña para acceder a la aplicación.
 - Como usuario, quiero iniciar sesión para poder usar las funcionalidades de la aplicación.
 - Como usuario, quiero que mi sesión sea segura y tenga una duración controlada.
 - Como usuario, quiero que solo yo pueda ver y modificar mis propios datos.
Módulo 2 — Movimientos financieros
 - Como usuario, quiero registrar un movimiento financiero con: tipo (ingreso / egreso), 
valor, descripción, categoría y fecha.
 - Como usuario, quiero editar y eliminar mis movimientos.
 - Como usuario, quiero listar mis movimientos con paginación y ordenamiento por fecha.
 - Como usuario, quiero filtrar mis movimientos por tipo, categoría y rango de fechas.
 - Como usuario, quiero ver un resumen de mi balance actual (total ingresos – total 
egresos).
Módulo 3 — Categorías y presupuestos
 - Como usuario, quiero crear y gestionar mis propias categorías de gasto.
 - Como usuario, quiero asignar un presupuesto mensual máximo a cada categoría.
 - Como usuario, quiero recibir una alerta (en la respuesta de la API) cuando el gasto 
acumulado en una categoría supere el 80% y el 100% de su presupuesto mensual.
 - Como usuario, quiero ver el estado de cada categoría: presupuesto total, gastado y 
porcentaje de uso.
# 3. Restricciones técnicas
Las siguientes restricciones son innegociables. No cumplir cualquiera de ellas es motivo de 
descarte directo, independientemente del estado de los demás entregables.
 - No se acepta almacenamiento en memoria ni mocks para datos de negocio. La 
persistencia debe ser real.
 - No se acepta código que el candidato no pueda explicar y defender en la sustentación.
Prueba Técnica — Desarrollador de Software | Fintech  ·  Página 2 de 4
Adicionalmente, la solución debe incluir pruebas automatizadas, un pipeline de CI/CD funcional 
y análisis de calidad de código. Los detalles de implementación de estos puntos son decisión 
del candidato y parte de lo que se evalúa.
# 4. Entregables
Para que la prueba sea válida, el(los) repositorio(s) debe contener:
Entregable
Descripción
Código fuente
Frontend y backend en el repositorio, organizados de forma clara 
y coherente con la arquitectura elegida
Script de inicio
Un comando levanta todo: base de datos, backend y frontend
README.md
Versiones exactas de runtimes, instrucciones de configuración, 
usuario y contraseña por defecto, justificación del stack elegido, y 
sección AI Usage (ver sección 6)
Historial de Git
Commits atómicos con mensajes descriptivos. El historial debe 
reflejar el proceso de desarrollo, no un solo commit con todo el 
código
Pipeline CI/CD
Pipeline funcional con jobs de test y análisis de calidad integrados
URL de despliegue
Incluir la URL en el README.
# 5. Tecnologías
No hay restricción de tecnología. El candidato elige libremente el stack, siempre que cumpla las 
restricciones de la sección 3. La elección debe estar justificada en el README con argumentos 
técnicos pertinentes para un producto financiero
# 6. Uso de herramientas de IA
El candidato es el responsable de cada decisión de diseño y de cada línea de código 
entregada.
El README debe incluir una sección llamada "AI Usage" con el siguiente contenido:
 - Herramientas de IA utilizadas (Cursor, Claude, Copilot, etc.) y para qué tareas 
específicas.
 - Al menos dos ejemplos concretos: ¿qué le pediste a la IA y qué obtuviste?
 - Al menos un ejemplo de algo que la IA sugirió y tú modificaste o rechazaste, con la 
razón técnica.
 - Tu valoración de cómo el uso de IA afectó la calidad o velocidad del desarrollo
# 7. Criterios de evaluación
La prueba se evalúa sobre 100 puntos. La seguridad y el uso de IA tienen carácter bloqueante: 
puntajes por debajo de los mínimos indicados descalifican la prueba independientemente del 
total


Categoría
Peso
Enfoque
Arquitectura y decisiones técnicas
25 pts
Calidad de las decisiones de diseño y 
capacidad de justificarlas
Requerimientos funcionales
20 pts
Todos los módulos funcionando 
correctamente
Seguridad
20 pts
Manejo adecuado de datos sensibles y 
acceso entre usuarios
Uso de IA
15 pts
Evidencia de criterio propio en el uso 
de herramientas de IA
Calidad, CI/CD y tests
15 pts
Cobertura con criterio, pipeline 
funcional, análisis de calidad
Entregables y documentación
5 pts
README completo, app funcional 
desde cero, historial de Git limpio
Total
100 pts

# 8. Preguntas frecuentes

¿El frontend necesita diseño visual bonito? 
No es un criterio de evaluación. Se valora que la interfaz sea funcional, consistente y permita 
validar todos los requerimientos, pero no el diseño estético.
¿Qué pasa si no alcanzo a implementar todo? 
Es preferible entregar menos funcionalidades bien construidas que todo el alcance con 
problemas de seguridad o arquitectura. Documenta en el README qué dejaste pendiente y por 
qué.
¿Puedo hacer preguntas de aclaración?
Sí. Ante una ambigüedad en los requisitos, toma la decisión que consideres más adecuada 
para un producto financiero real y documéntala. La forma en que manejes la ambigüedad 
también es parte de la evaluación.
