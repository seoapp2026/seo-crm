import re
import urllib.request
from collections import Counter
from html.parser import HTMLParser

from app.schemas_phase2 import (
    CompetitorHeadingItem,
    CompetitorScrapeRequest,
    CompetitorScrapeResponse,
    ProductItemIn,
)


class ContentExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_desc = ""
        self.headings: list[CompetitorHeadingItem] = []
        self.has_table = False
        self.in_title = False
        self.current_tag = None
        self.text_chunks: list[str] = []
        self.heading_buffer: list[str] = []

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag.lower()
        if self.current_tag == "title":
            self.in_title = True
        elif self.current_tag == "meta":
            attr_dict = {k.lower(): v for k, v in attrs}
            if attr_dict.get("name", "").lower() == "description":
                self.meta_desc = attr_dict.get("content", "")
        elif self.current_tag in ("h1", "h2", "h3"):
            self.heading_buffer = []
        elif self.current_tag == "table":
            self.has_table = True

    def handle_endtag(self, tag):
        t = tag.lower()
        if t == "title":
            self.in_title = False
        elif t in ("h1", "h2", "h3"):
            text = "".join(self.heading_buffer).strip()
            if text:
                level = int(t[1])
                self.headings.append(CompetitorHeadingItem(level=level, tag=t.upper(), text=text))
            self.heading_buffer = []
        self.current_tag = None

    def handle_data(self, data):
        cleaned = data.strip()
        if self.in_title:
            self.title += " " + cleaned
        elif self.current_tag in ("h1", "h2", "h3"):
            self.heading_buffer.append(data)
        if cleaned and self.current_tag not in ("script", "style", "noscript"):
            self.text_chunks.append(cleaned)


def scrape_competitor_structure(request: CompetitorScrapeRequest) -> CompetitorScrapeResponse:
    html_content = request.raw_html or ""

    if not html_content and request.url:
        try:
            req = urllib.request.Request(
                request.url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                html_content = response.read().decode("utf-8", errors="replace")
        except Exception as e:
            # Return structured fallback if remote URL cannot be reached
            return CompetitorScrapeResponse(
                title=f"Analisis de {request.url}",
                meta_description=f"No se pudo descargar directamente ({str(e)}). Pega el HTML manualmente.",
                h1=f"URL: {request.url}",
                headings=[],
                word_count=0,
                detected_products=[],
                detected_keywords=[],
                has_comparison_table=False,
                extracted_summary=f"Fallo al conectar con {request.url}: {str(e)}",
            )

    parser = ContentExtractor()
    parser.feed(html_content)

    title = parser.title.strip() or "Sin titulo"
    meta_desc = parser.meta_desc.strip() or None
    h1 = next((h.text for h in parser.headings if h.tag == "H1"), None)

    # Word count and Keyword extraction
    full_text = " ".join(parser.text_chunks)
    words = re.findall(r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]{3,}", full_text.lower())
    word_count = len(words)

    stopwords = {
        "para", "como", "este", "esta", "estos", "estas", "pero", "sobre", "entre", "todos",
        "todo", "toda", "todas", "desde", "hasta", "hacer", "puede", "pueden", "tiene", "tienen",
        "mas", "menos", "muy", "que", "con", "por", "los", "las", "del", "una", "uno", "unos", "unas",
    }
    meaningful_words = [w for w in words if w not in stopwords and len(w) > 3]
    top_keywords = [k for k, _ in Counter(meaningful_words).most_common(8)]

    # Product Entity detection heuristic from H2/H3 headings
    detected_products: list[ProductItemIn] = []
    price_pattern = re.compile(r"(\d{1,4}(?:[.,]\d{2})?\s*(?:€|\$|EUR|USD))", re.IGNORECASE)
    rating_pattern = re.compile(r"(\d(?:[.,]\d)?\s*/\s*5|★★★★★|★★★★|★★★)", re.IGNORECASE)

    for h in parser.headings:
        if h.level in (2, 3) and len(h.text.split()) >= 2:
            # Check if heading looks like a product review item
            t_lower = h.text.lower()
            if any(num in h.text for num in ["1.", "2.", "3.", "4.", "5.", "#1", "#2", "#3", "top", "mejor"]) or any(b in t_lower for b in ["cecotec", "delonghi", "philips", "krups", "nespresso", "oster", "braun", "bosch", "rowenta", "xiaomi", "samsung", "apple", "lg"]):
                clean_name = re.sub(r"^[0-9]+[.\-)]\s*", "", h.text).strip()
                # Keep only what is actually visible in the heading — never invent
                # price, rating, pros/cons or specs that the page does not show.
                detected_products.append(
                    ProductItemIn(
                        name=clean_name,
                        brand=clean_name.split()[0] if clean_name else None,
                        model=" ".join(clean_name.split()[1:]) if len(clean_name.split()) > 1 else None,
                    )
                )

    summary = f"Pagina con {len(parser.headings)} encabezados, aprox {word_count} palabras. "
    if parser.has_table:
        summary += "Contiene tabla(s) comparativa(s) o de especificaciones. "
    if detected_products:
        summary += f"Se detectaron {len(detected_products)} posibles productos analizados."

    return CompetitorScrapeResponse(
        title=title,
        meta_description=meta_desc,
        h1=h1,
        headings=parser.headings,
        word_count=word_count,
        detected_products=detected_products[:8],
        detected_keywords=top_keywords,
        has_comparison_table=parser.has_table,
        extracted_summary=summary,
    )