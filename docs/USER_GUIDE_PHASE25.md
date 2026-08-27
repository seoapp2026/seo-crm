# Manual de Usuario y Guía de Uso — SEO CRM (Fase 2.5)

Bienvenido a la versión ampliada de **SEO CRM (Fase 2.5)**. Esta guía detalla el flujo de trabajo completo y todas las herramientas disponibles para planificar, estructurar con IA, generar maquetaciones HTML Divi/WordPress y publicar tus páginas y metas SEO con un solo clic.

---

## 1. Biblioteca Dinámica de Prompts IA (`/prompts`)
- **Gestor CRUD**: Crea, edita, duplica o reordena los prompts de los asistentes IA según el flujo de trabajo de tu agencia.
- **Variables Dinámicas**: Usa marcadores `{project_name}`, `{niche_name}`, `{page_title}`, `{h1}`, `{focus_keyword}`, `{secondary_keywords}`, `{silo_parent_title}`, `{internal_links}` en el contenido del prompt.
- **Ejecución Flexible**: En `/assistants`, selecciona cualquiera de tus prompts y visualiza el resultado generado directamente.

---

## 2. Jerarquía de Silos & Metas SEO Enriquecidas (`/pages`)
- **Estructura Silo**: Asigna páginas padre (Pilares) a subpáginas (Clústeres) para organizar silos temáticos limpios.
- **Metas Rank Math**: Configura `H1`, `SEO Title` (contador visual máx. 60 caracteres), `SEO Description` (máx. 160 caracteres), `Categoría WP` y `Etiquetas`.
- **Palabra Clave Principal Exclusiva**: Cada página cuenta con una Focus Keyword exclusiva identificada con una estrella dorada `★ Focus` en `/keywords`.

---

## 3. Maquetador IA Divi / WordPress (`/pages` & `/assistants`)
- **Reglas de Maquetación por Nicho**: Define directrices de diseño específicas por nicho en `/niches`.
- **Generación HTML**: El Maquetador IA transforma borradores en código HTML semántico compatible con el módulo de Código de Divi y el editor clásico/Gutenberg de WordPress.
- **Previsualización en Vivo**: Alterna entre el código HTML y la vista renderizada en el editor de páginas.

---

## 4. Constructor & Inspector de Contexto IA (`/assistants`)
- **Drawer de Contexto**: Haz clic en `👁️ Ver Contexto Completo` para inspeccionar en tiempo real todas las entidades resueltas (proyecto, nicho, silo, keywords, enlaces internos, métricas GSC/GA4).
- **Estimación de Tokens**: Visualiza el conteo de palabras y tokens estimados antes de realizar la llamada al modelo LLM.

---

## 5. Auto-Clustering IA & Etiquetado SERP (`/keywords`)
- **⚡ Auto-Etiquetar Intención**: Clasifica masivamente las palabras clave en `Informacional`, `Comercial` o `Transaccional`.
- **🧠 Auto-Clustering IA**: Agrupa automáticamente cientos de palabras clave en clústeres temáticos, sugiriendo Focus Keyword, título optimizado, H1 y tipo de página (`TSG` Guía Pilar, `TSR` Comparativa, `TSA` Review).
- **Creación en Lote**: Convierte los clústeres sugeridos en páginas reales vinculadas con un solo clic.

---

## 6. Generador de Tablas Comparativas & Scraper de Competidores (`/competitors`)
- **📊 Tablas Comparativas Responsive**: Diseña tablas de productos para afiliados con badges destacados (*Mejor Calidad-Precio ⭐*, *Nuestra Elección*), precios, valoraciones, filas de especificaciones y botones CTA (`rel="nofollow sponsored noopener"`).
- **🔍 Scraper de Competidores**: Pega una URL o código HTML para extraer la jerarquía de encabezados (H1-H3), conteo de palabras, productos analizados y transferirlos a la tabla comparativa.

---

## 7. Rank Math SEO Import / Export & Bulk Sync (`/wordpress` & `/pages`)
- **📥 Descarga CSV Rank Math**: Descarga un CSV optimizado con UTF-8 BOM listo para la herramienta de importación de Rank Math.
- **📤 Importar CSV Rank Math**: Sube un archivo CSV con títulos y descripciones para sincronizarlos en masa en el CRM.
- **⚡ Auto-Completar Metas IA**: Rellena automáticamente los títulos SEO y meta descripciones faltantes en todo el proyecto.

---

## 8. Vista Cuadrícula Rápida & Edición Masiva (`/pages`)
- **Modo Cuadrícula**: Alterna a la vista tipo Excel para editar inline títulos, H1, metas SEO, silos, estados y marcado `Export Ready`.
- **Contadores de Caracteres en Tiempo Real**: Indicadores de color para asegurar que tus títulos (≤60) y descripciones (≤160) se ajusten a los límites de Google.
- **Atajo de Teclado**: Presiona `Cmd + S` (o `Ctrl + S`) para guardar todos los cambios masivos de forma instantánea.

---

## 9. Exportación WordPress & Push REST API (`/wordpress`)
- **Formatos de Descarga**:
  - `CSV WP All Import`: Para importación con mapeo de campos personalizados.
  - `ZIP Bundle`: Archivo comprimido con CSVs, JSON de estructura y archivos `.html` individuales maquetados.
- **🚀 Push Directo REST API**: Conecta tu web mediante contraseñas de aplicación de WordPress para crear borradores o publicar páginas y entradas con sus metadatos de Rank Math automáticamente.