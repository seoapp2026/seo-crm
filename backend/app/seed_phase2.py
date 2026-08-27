from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    AiPrompt,
    AssistantSlug,
    GoogleAuth,
    GoogleServiceType,
    Project,
    SyncJob,
    SyncJobType,
)


AI_PROMPTS_SEED = [
    {
        "slug": "seo_architect",
        "name": "Arquitecto SEO",
        "description": "Analiza la estructura del nicho y propone arquitectura de contenido (pilares, clusters, enlazado).",
        "system_prompt": (
            "Eres un arquitecto SEO senior. Analiza el nicho, páginas existentes y keywords. "
            "Propón estructura de pilares/clusters, prioridades y enlazado interno. Responde en español. "
            "No publiques nada automáticamente."
        ),
        "model_default": "gpt-4o-mini",
        "sort_order": 0,
        "is_system": True,
    },
    {
        "slug": "keyword_classifier",
        "name": "Clasificador de Keywords",
        "description": "Clasifica términos por intención, dificultad estimada y página objetivo.",
        "system_prompt": (
            "Eres un especialista en investigación de keywords. Clasifica cada término: intención "
            "(informacional/comercial/transaccional), prioridad y página sugerida. Señala canibalización. Español."
        ),
        "model_default": "gpt-4o-mini",
        "sort_order": 10,
        "is_system": True,
    },
    {
        "slug": "content_generator",
        "name": "Generador de Contenido (enriquecido)",
        "description": "Genera borradores usando métricas reales de GSC y Analytics cuando están disponibles.",
        "system_prompt": (
            "Eres redactor SEO. Genera borradores editables (meta, H1, cuerpo, FAQ) usando contexto de página, "
            "keywords y métricas GSC/GA4 si se proporcionan. Nunca inventes datos de tráfico sin métricas. Español."
        ),
        "model_default": "gpt-4o-mini",
        "sort_order": 20,
        "is_system": True,
    },
    {
        "slug": "competitor_analyst",
        "name": "Analista de Competencia",
        "description": "Compara tu contenido con dominios competidores y detecta brechas.",
        "system_prompt": (
            "Eres analista de competencia SEO. Compara el proyecto con dominios rivales: brechas de contenido, "
            "oportunidades de keywords y diferenciación. Español. Supervisado."
        ),
        "model_default": "gpt-4o",
        "sort_order": 30,
        "is_system": True,
    },
    {
        "slug": "continuous_optimizer",
        "name": "Optimizador Continuo",
        "description": "Sugiere mejoras en páginas con caída de rendimiento según histórico GSC/Analytics.",
        "system_prompt": (
            "Eres consultor de optimización SEO continua. Usa tendencias de clicks, posición y engagement "
            "para priorizar acciones concretas (título, snippet, enlaces, actualización). Español."
        ),
        "model_default": "gpt-4o-mini",
        "sort_order": 40,
        "is_system": True,
    },
]

SYNC_JOB_DEFAULTS = {
    SyncJobType.gsc: ("Diario · 06:00", settings.sync_gsc_cron),
    SyncJobType.ga4: ("Diario · 07:00", settings.sync_ga4_cron),
    SyncJobType.ads: ("Semanal · lunes 08:00", settings.sync_ads_cron),
}


def seed_phase2(db: Session):
    if db.query(AiPrompt).count() == 0:
        for item in AI_PROMPTS_SEED:
            db.add(
                AiPrompt(
                    slug=item["slug"],
                    name=item["name"],
                    description=item["description"],
                    system_prompt=item["system_prompt"],
                    model_default=item.get("model_default", "gpt-4o-mini"),
                    sort_order=item.get("sort_order", 0),
                    is_system=item.get("is_system", True),
                )
            )
    else:
        # Ensure existing seeded prompts have sort_order set if 0
        existing = {p.slug: p for p in db.query(AiPrompt).all()}
        for item in AI_PROMPTS_SEED:
            p = existing.get(item["slug"])
            if p and p.sort_order == 0 and item["sort_order"] != 0:
                p.sort_order = item["sort_order"]
                p.is_system = True

    for project in db.query(Project).all():
        for service in GoogleServiceType:
            exists = (
                db.query(GoogleAuth)
                .filter(GoogleAuth.project_id == project.id, GoogleAuth.service == service)
                .first()
            )
            if not exists:
                db.add(GoogleAuth(project_id=project.id, service=service))

        for job_type, (schedule, cron) in SYNC_JOB_DEFAULTS.items():
            exists = (
                db.query(SyncJob)
                .filter(SyncJob.project_id == project.id, SyncJob.job_type == job_type)
                .first()
            )
            if not exists:
                enabled = True
                last_error = None
                if job_type == SyncJobType.ads and not settings.google_ads_developer_token:
                    last_error = (
                        "Google Ads: falta GOOGLE_ADS_DEVELOPER_TOKEN "
                        "(o conecta OAuth y sincroniza tras configurar el token)"
                    )
                    enabled = False
                db.add(
                    SyncJob(
                        project_id=project.id,
                        job_type=job_type,
                        schedule=schedule,
                        schedule_cron=cron,
                        enabled=enabled,
                        last_error=last_error,
                    )
                )

    # Re-enable Ads jobs once developer token is configured
    if settings.google_ads_developer_token:
        for job in db.query(SyncJob).filter(SyncJob.job_type == SyncJobType.ads).all():
            if not job.enabled:
                job.enabled = True
            if job.last_error and (
                "developer token" in job.last_error.lower()
                or "GOOGLE_ADS_DEVELOPER_TOKEN" in job.last_error
            ):
                job.last_error = None

    db.commit()