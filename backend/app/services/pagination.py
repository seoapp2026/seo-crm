"""Paginación de endpoints de listado (WP7).

skip/limit en query params y totales en cabeceras de respuesta
(X-Total-Count, X-Skip, X-Limit) para no romper consumidores existentes.
"""

from fastapi import Response

DEFAULT_SKIP = 0
DEFAULT_LIMIT = 200
MAX_LIMIT = 1000


def fetch_page(q, skip: int, limit: int):
    """Devuelve (items, total) aplicando offset/limit sobre la query filtrada."""
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total


def set_page_headers(response: Response, total: int, skip: int, limit: int) -> None:
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Skip"] = str(skip)
    response.headers["X-Limit"] = str(limit)
