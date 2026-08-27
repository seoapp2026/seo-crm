import re
import unicodedata
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models import Intent, Keyword, Page, PageType, Url
from app.schemas import (
    AutoTagIntentResponse,
    ClusterApplyItem,
    ClusterApplyResponse,
    ClusterItemOut,
    ClusterSuggestionResponse,
)

STOPWORDS = {
    "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "para", "en", "con",
    "por", "sobre", "a", "al", "y", "o", "que", "como", "cual", "cuales", "es", "son",
    "segun", "entre", "hacia", "hasta", "sin", "tras", "durante", "mediante", "vs", "frente",
}

TRANSACTIONAL_PATTERNS = [
    r"\bcomprar\b", r"\bprecio\b", r"\bprecios\b", r"\boferta\b", r"\bofertas\b",
    r"\bdescuento\b", r"\bdescuentos\b", r"\bbarato\b", r"\bbarata\b", r"\bbaratos\b",
    r"\bbaratas\b", r"\bdonde comprar\b", r"\btienda\b", r"\btiendas\b", r"\brebajas\b",
    r"\bcupon\b", r"\bamazon\b", r"\bvender\b", r"\bcatalogo\b", r"\bonline\b",
    r"\bcontratar\b", r"\bcoste\b", r"\bcuesta\b", r"\balquilar\b", r"\bventa\b",
]

COMMERCIAL_PATTERNS = [
    r"\bmejor\b", r"\bmejores\b", r"\btop\b", r"\bcomparativa\b", r"\bopiniones\b",
    r"\bopinion\b", r"\banalisis\b", r"\breview\b", r"\breviews\b", r"\bvs\b",
    r"\bmerece la pena\b", r"\branking\b", r"\brecomendados\b", r"\brecomendadas\b",
    r"\bmarcas de\b", r"\bcalidad precio\b", r"\bpros y contras\b", r"\bguia de compra\b",
]

INFORMATIONAL_PATTERNS = [
    r"^que es\b", r"^como\b", r"^cuando\b", r"^donde\b", r"^por que\b", r"^cual es\b",
    r"\bguia\b", r"\btutorial\b", r"\bdefinicion\b", r"\bsignificado\b", r"\bconsejos\b",
    r"\bpasos para\b", r"\btipos de\b", r"\borigen\b", r"\bhistoria\b", r"\bfuncionamiento\b",
    r"\bcomo funciona\b", r"\bcomo usar\b", r"\bcomo limpiar\b", r"\bcomo reparar\b",
    r"\bdiferencias entre\b", r"\bventajas\b", r"\bbeneficios\b",
]


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slugify(text: str) -> str:
    norm = normalize_text(text)
    return norm.replace(" ", "-")


def classify_keyword_intent(term: str) -> Intent:
    norm = normalize_text(term)

    # 1. Transactional check
    for pat in TRANSACTIONAL_PATTERNS:
        if re.search(pat, norm):
            return Intent.transaccional

    # 2. Commercial check
    for pat in COMMERCIAL_PATTERNS:
        if re.search(pat, norm):
            return Intent.comercial

    # 3. Informational check
    for pat in INFORMATIONAL_PATTERNS:
        if re.search(pat, norm):
            return Intent.informacional

    # Default heuristic: if contains specific brand/model without transactional words -> comercial
    tokens = norm.split()
    if len(tokens) >= 3 and any(t in norm for t in ["pro", "max", "ultra", "plus", "mini", "lite", "series"]):
        return Intent.comercial

    return Intent.informacional


def auto_tag_keywords_intent(
    db: Session,
    project_id: int,
    niche_id: int | None = None,
    keyword_ids: list[int] | None = None,
) -> AutoTagIntentResponse:
    q = db.query(Keyword).filter(Keyword.project_id == project_id)
    if niche_id:
        q = q.filter(Keyword.niche_id == niche_id)
    if keyword_ids:
        q = q.filter(Keyword.id.in_(keyword_ids))

    keywords = q.all()
    counts = {"informacional": 0, "comercial": 0, "transaccional": 0}

    for kw in keywords:
        new_intent = classify_keyword_intent(kw.term)
        kw.intent = new_intent
        counts[new_intent.value] += 1

    db.commit()

    return AutoTagIntentResponse(
        updated_count=len(keywords),
        informational_count=counts["informacional"],
        commercial_count=counts["comercial"],
        transactional_count=counts["transaccional"],
    )


def _extract_core_tokens(term: str) -> set[str]:
    norm = normalize_text(term)
    tokens = [t for t in norm.split() if t not in STOPWORDS and len(t) > 2]
    # Remove generic intent modifiers from core root
    modifier_words = {
        "mejor", "mejores", "top", "comparativa", "opiniones", "opinion", "analisis", "review",
        "comprar", "precio", "precios", "oferta", "ofertas", "barato", "barata", "guia", "como",
        "donde", "que", "online", "tienda",
    }
    core = {t for t in tokens if t not in modifier_words}
    return core if core else set(tokens)


def suggest_keyword_clusters(
    db: Session,
    project_id: int,
    niche_id: int | None = None,
    unassigned_only: bool = False,
) -> ClusterSuggestionResponse:
    q = db.query(Keyword).filter(Keyword.project_id == project_id)
    if niche_id:
        q = q.filter(Keyword.niche_id == niche_id)
    if unassigned_only:
        q = q.filter(Keyword.page_id.is_(None))

    keywords = q.all()
    if not keywords:
        return ClusterSuggestionResponse(total_keywords_analyzed=0, clusters_count=0, clusters=[])

    # Build clusters by matching core token sets
    clusters_map: dict[str, list[Keyword]] = defaultdict(list)

    for kw in keywords:
        core_tokens = _extract_core_tokens(kw.term)
        if not core_tokens:
            cluster_key = normalize_text(kw.term)
        else:
            cluster_key = " ".join(sorted(core_tokens))

        # Find best existing cluster key with high entity overlap
        matched_key = None
        for existing_key in clusters_map.keys():
            existing_tokens = set(existing_key.split())
            intersection = core_tokens.intersection(existing_tokens)
            min_len = min(len(core_tokens), len(existing_tokens))
            overlap = len(intersection) / min_len if min_len > 0 else 0
            if overlap >= 0.5 or len(intersection) >= 2:
                matched_key = existing_key
                break

        if matched_key:
            clusters_map[matched_key].append(kw)
        else:
            clusters_map[cluster_key].append(kw)

    result_clusters: list[ClusterItemOut] = []

    for key, kw_list in clusters_map.items():
        # Sort keywords inside cluster: prefer primary, then commercial/transactional, then shortest term
        def kw_rank(k: Keyword):
            intent_score = 3 if k.intent == Intent.comercial else (2 if k.intent == Intent.transaccional else 1)
            primary_score = 10 if k.is_primary else 0
            return (primary_score, intent_score, -len(k.term))

        sorted_kws = sorted(kw_list, key=kw_rank, reverse=True)
        focus_kw = sorted_kws[0]
        secondary_kws = [k.term for k in sorted_kws[1:]]

        # Determine dominant intent
        intents_count = defaultdict(int)
        for k in sorted_kws:
            intents_count[k.intent] += 1
        dom_intent = max(intents_count.items(), key=lambda x: x[1])[0]

        # Suggest page type
        norm_focus = normalize_text(focus_kw.term)
        if "mejores" in norm_focus or "comparativa" in norm_focus or "top" in norm_focus:
            page_type = PageType.TSR
        elif len(norm_focus.split()) >= 3 and (dom_intent in (Intent.comercial, Intent.transaccional)):
            page_type = PageType.TSA
        else:
            page_type = PageType.TSG

        # Cluster Name & Title
        cluster_name = " ".join(w.capitalize() for w in key.split())
        if page_type == PageType.TSR:
            suggested_title = f"Mejores {cluster_name} 2026: Comparativa y Opiniones"
            suggested_h1 = f"Guía Comparativa: Mejores {cluster_name}"
        elif page_type == PageType.TSA:
            suggested_title = f"{cluster_name}: Opiniones, Precios y Análisis a Fondo"
            suggested_h1 = f"{cluster_name} — Análisis Detallado y Veredicto"
        else:
            suggested_title = f"Guía Completa de {cluster_name} (2026)"
            suggested_h1 = f"Todo sobre {cluster_name}: Guía Definitiva"

        # Check existing page association
        existing_page_id = next((k.page_id for k in sorted_kws if k.page_id), None)
        existing_page_title = None
        if existing_page_id:
            page_obj = db.get(Page, existing_page_id)
            if page_obj:
                existing_page_title = page_obj.title

        result_clusters.append(
            ClusterItemOut(
                cluster_id=f"cluster_{slugify(cluster_name)}",
                cluster_name=cluster_name,
                focus_keyword=focus_kw.term,
                secondary_keywords=secondary_kws,
                suggested_title=suggested_title,
                suggested_h1=suggested_h1,
                suggested_type=page_type,
                intent=dom_intent,
                keyword_ids=[k.id for k in sorted_kws],
                existing_page_id=existing_page_id,
                existing_page_title=existing_page_title,
            )
        )

    return ClusterSuggestionResponse(
        total_keywords_analyzed=len(keywords),
        clusters_count=len(result_clusters),
        clusters=result_clusters,
    )


def apply_keyword_clusters(
    db: Session,
    project_id: int,
    clusters: list[ClusterApplyItem],
) -> ClusterApplyResponse:
    created_pages_count = 0
    updated_pages_count = 0
    linked_keywords_count = 0
    created_page_ids: list[int] = []

    for item in clusters:
        target_page_id = item.existing_page_id

        if not target_page_id:
            # Create new Page
            new_page = Page(
                project_id=project_id,
                niche_id=item.niche_id,
                parent_page_id=item.parent_page_id,
                title=item.title,
                h1=item.h1 or item.title,
                type=item.type.value if hasattr(item.type, "value") else str(item.type),
                state="borrador",
                content_status="borrador",
            )
            db.add(new_page)
            db.flush()
            target_page_id = new_page.id
            created_page_ids.append(target_page_id)
            created_pages_count += 1

            # Create URL
            page_slug = f"/{slugify(item.title)}"
            db.add(
                Url(
                    project_id=project_id,
                    niche_id=item.niche_id,
                    page_id=target_page_id,
                    slug=page_slug,
                )
            )
        else:
            updated_pages_count += 1

        # Link keywords to page
        target_kws = db.query(Keyword).filter(Keyword.id.in_(item.keyword_ids)).all()
        focus_id = item.focus_keyword_id or (target_kws[0].id if target_kws else None)

        for kw in target_kws:
            kw.page_id = target_page_id
            kw.niche_id = item.niche_id
            kw.is_primary = (kw.id == focus_id)
            linked_keywords_count += 1

    db.commit()

    return ClusterApplyResponse(
        created_pages_count=created_pages_count,
        updated_pages_count=updated_pages_count,
        linked_keywords_count=linked_keywords_count,
        created_page_ids=created_page_ids,
    )
