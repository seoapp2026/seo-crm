# Manual de Uso y Lógica de Funcionamiento — CRM SEO

Este documento explica, en lenguaje sencillo, cómo funciona el sistema por dentro. No hace falta que entiendas de programación — solo la lógica del flujo, para que sepas qué hace cada parte y qué te toca hacer a ti.

## 1. La idea general

El sistema organiza tu trabajo de SEO en una estructura simple:

**Proyecto → Nicho → Página → Palabra clave → URL**

Un Proyecto agrupa tus webs. Dentro de cada proyecto hay Nichos (temas). Dentro de cada nicho hay Páginas (guías, comparativas, reseñas). Cada página tiene sus Palabras clave asignadas. Y cada página tiene una URL con su estado de indexación.

Todo lo que haces en el sistema cuelga de esta estructura.

## 2. Qué hace la Fase 1 (ya funcionando)

La Fase 1 es el esqueleto: donde guardas y organizas toda tu información.

- Ves un resumen general en el Panel.
- Creas y organizas Proyectos, Nichos, Páginas, Keywords y URLs.
- El sistema te avisa si repites una keyword en dos páginas (canibalización).
- Ves el enlazado interno y si hay páginas huérfanas (sin enlaces).
- Generas borradores de contenido con IA según el tipo de página.

En esta fase, tú metes la información y el sistema la organiza. Todavía no hay datos reales de Google conectados — eso llega en la Fase 2.

## 3. Qué añade la Fase 2 (en desarrollo, ~50% hecho)

Aquí es donde el sistema empieza a traer datos reales y a usar la IA de forma más avanzada.

### 3.1 Conexión con Google

El sistema se conecta directamente a:

- **Google Search Console** → impresiones, clics, CTR, posición real de cada página.
- **Google Analytics** → tráfico y comportamiento de los usuarios en tus páginas.
- **Google Ads / Keyword Planner** → volumen de búsqueda real de las keywords.

Estos datos se guardan automáticamente en el sistema, vinculados a cada página y cada keyword. Tú no tienes que ir a buscar estos datos a mano — el sistema los trae solo.

### 3.2 Los asistentes de IA

En vez de un solo generador de contenido, la Fase 2 tiene varios "asistentes", cada uno especializado en una tarea:

| Asistente | Qué hace |
|||
| Arquitecto SEO | Propone qué páginas y categorías crear |
| Clasificador de keywords | Decide qué keyword va en qué página y con qué prioridad |
| Generador de contenido | Escribe el contenido, ahora usando los datos reales de Google |
| Analista de competencia | Revisa qué hace la competencia y qué mejorar |
| Optimizador continuo | Detecta páginas que están bajando de rendimiento y sugiere cambios |

### 3.3 Cómo se conecta todo — esto es lo importante

Esta es tu duda principal, así que vamos despacio:

**No tienes que pasar resultados de un GPT a otro a mano.** El sistema lo hace automáticamente por dentro. Funciona así:

1. Tú eliges una página o una tarea (por ejemplo: "optimizar esta página").
2. El sistema mira solo, sin que hagas nada, qué datos necesita esa tarea (por ejemplo, si hace falta el dato de Search Console o el de Analytics) y los coge de donde correspondan.
3. Esos datos se meten automáticamente en el prompt del asistente adecuado.
4. La IA genera el resultado.
5. Si esa tarea necesita un segundo paso (por ejemplo, primero clasificar la keyword y luego generar el contenido), el sistema pasa el resultado del primer asistente al segundo automáticamente.
6. Al final, te muestra el resultado completo a ti.
7. **Tú revisas y decides** si lo apruebas, lo editas, o lo descartas. El sistema nunca publica nada por su cuenta.

Todo esto ocurre con un solo clic por tu parte. No hace falta ninguna herramienta externa tipo Make o Zapier — como el sistema está hecho a medida, esa "cadena" de pasos ya está construida dentro del propio programa.

### 3.4 El panel de rendimiento

Una pantalla donde ves de un vistazo qué páginas van bien y cuáles necesitan trabajo, basado en los datos reales que llegan de Google.

### 3.5 Los prompts son editables

Cada asistente tiene su prompt guardado en el sistema (no está "cableado" en el código). Esto significa que si en el futuro quieres cambiar cómo escribe o qué prioriza un asistente, se edita el texto del prompt sin tener que rehacer el programa.

## 4. Flujo completo, de principio a fin

```
Google (datos reales)
      ↓
El sistema guarda los datos en tu página/keyword correspondiente
      ↓
Eliges una tarea (ej: "optimizar esta página")
      ↓
El sistema elige el/los prompt(s) adecuados y mete los datos automáticamente
      ↓
La IA genera el resultado (puede ser un paso o varios encadenados)
      ↓
Tú revisas, editas si hace falta, y apruebas
      ↓
Se publica en WordPress
```

## 5. Preguntas frecuentes

**¿Necesito usar Make, Zapier o algo parecido?**
No. Todo el encadenado de pasos está construido dentro del propio sistema.

**¿Tengo que decirle a mano de dónde coger cada dato (Analytics o Search Console)?**
No, el sistema ya sabe qué dato necesita cada asistente según la tarea. Si en algún caso quieres elegir tú manualmente, se puede añadir esa opción, pero no es necesario para el funcionamiento normal.

**¿Puede el sistema publicar solo, sin que yo lo revise?**
No. El sistema es supervisado: la IA propone, tú apruebas. Nunca publica nada sin tu revisión.

**¿Puedo cambiar cómo escribe un asistente más adelante?**
Sí, editando su prompt desde el propio sistema, sin tocar el código ni rehacer nada.

Cualquier duda que te surja mientras avanzamos, dímelo y lo aclaramos aquí mismo, en texto simple, para que siempre tengas claro qué hace cada parte.
