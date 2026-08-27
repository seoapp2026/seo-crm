import html
from app.schemas_phase2 import (
    ComparisonTableGenerateRequest,
    ComparisonTableGenerateResponse,
    ProductItemIn,
)


def generate_comparison_table_html(
    request: ComparisonTableGenerateRequest,
) -> ComparisonTableGenerateResponse:
    products = request.products
    if not products:
        return ComparisonTableGenerateResponse(
            html_table="<p>No hay productos para generar la tabla comparativa.</p>",
            preview_cards_html="<p>No hay productos.</p>",
            spec_columns=[],
            products_count=0,
        )

    # 1. Discover all unique spec keys preserving order
    spec_keys: list[str] = []
    for p in products:
        for k in p.specs.keys():
            if k not in spec_keys:
                spec_keys.append(k)

    title_escaped = html.escape(request.table_title or "Tabla Comparativa")

    # 2. Build HTML Table
    table_lines: list[str] = []
    table_lines.append("<!-- TABLA COMPARATIVA SEO CRM - INICIO -->")
    table_lines.append("<div class=\"seo-comparison-wrapper\" style=\"margin: 32px 0; font-family: system-ui, -apple-system, sans-serif;\">")
    table_lines.append(f"  <h2 style=\"font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 20px; text-align: center;\">{title_escaped}</h2>")
    table_lines.append("  <div style=\"overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; background: #ffffff;\">")
    table_lines.append("    <table style=\"width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;\">")
    table_lines.append("      <thead>")
    table_lines.append("        <tr style=\"background: #f8fafc; border-bottom: 2px solid #e2e8f0;\">")
    table_lines.append("          <th style=\"padding: 16px; text-align: left; font-weight: 600; color: #475569; min-width: 160px;\">Modelo</th>")

    for p in products:
        p_name = html.escape(p.name)
        p_badge = html.escape(p.badge) if p.badge and request.show_badges else ""
        badge_html = f"<div style=\"display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;\">{p_badge}</div><br>" if p_badge else ""
        img_html = f"<img src=\"{html.escape(p.image_url)}\" alt=\"{p_name}\" style=\"max-height: 90px; max-width: 100%; object-fit: contain; margin-bottom: 8px;\"><br>" if p.image_url else ""
        rating_html = f"<div style=\"color: #eab308; font-weight: 600; font-size: 13px; margin-top: 4px;\">&#9733; {html.escape(p.rating)}</div>" if p.rating and request.show_ratings else ""

        table_lines.append("          <th style=\"padding: 16px; min-width: 200px; vertical-align: top;\">")
        if badge_html:
            table_lines.append(f"            {badge_html}")
        if img_html:
            table_lines.append(f"            {img_html}")
        table_lines.append(f"            <strong style=\"font-size: 15px; color: #0f172a; display: block;\">{p_name}</strong>")
        if rating_html:
            table_lines.append(f"            {rating_html}")
        table_lines.append("          </th>")

    table_lines.append("        </tr>")
    table_lines.append("      </thead>")
    table_lines.append("      <tbody>")

    # Price Row
    table_lines.append("        <tr style=\"border-bottom: 1px solid #f1f5f9; background: #fdfdfd;\">")
    table_lines.append("          <td style=\"padding: 14px 16px; text-align: left; font-weight: 600; color: #334155;\">Precio aprox.</td>")
    for p in products:
        price_text = html.escape(p.price) if p.price else "Consultar"
        table_lines.append(f"          <td style=\"padding: 14px 16px; font-weight: 700; color: #059669; font-size: 16px;\">{price_text}</td>")
    table_lines.append("        </tr>")

    # Specs Rows
    for spec in spec_keys:
        spec_escaped = html.escape(spec)
        table_lines.append("        <tr style=\"border-bottom: 1px solid #f1f5f9;\">")
        table_lines.append(f"          <td style=\"padding: 12px 16px; text-align: left; font-weight: 500; color: #64748b;\">{spec_escaped}</td>")
        for p in products:
            val = html.escape(p.specs.get(spec, "—"))
            table_lines.append(f"          <td style=\"padding: 12px 16px; color: #1e293b;\">{val}</td>")
        table_lines.append("        </tr>")

    # Pros & Cons Row
    if request.show_pros_cons:
        table_lines.append("        <tr style=\"border-bottom: 1px solid #f1f5f9; background: #fafafa;\">")
        table_lines.append("          <td style=\"padding: 14px 16px; text-align: left; font-weight: 600; color: #334155; vertical-align: top;\">Puntos Clave</td>")
        for p in products:
            pros_html = "".join([f"<li style=\"color: #166534; font-size: 12px; margin-bottom: 3px;\">&#10003; {html.escape(pro)}</li>" for pro in p.pros[:3]])
            cons_html = "".join([f"<li style=\"color: #991b1b; font-size: 12px; margin-bottom: 3px;\">&#10005; {html.escape(con)}</li>" for con in p.cons[:2]])
            table_lines.append("          <td style=\"padding: 14px 16px; text-align: left; vertical-align: top;\">")
            table_lines.append("            <ul style=\"list-style: none; padding-left: 0; margin: 0;\">")
            if pros_html:
                table_lines.append(f"              {pros_html}")
            if cons_html:
                table_lines.append(f"              {cons_html}")
            table_lines.append("            </ul>")
            table_lines.append("          </td>")
        table_lines.append("        </tr>")

    # CTA Button Row
    table_lines.append("        <tr style=\"background: #f8fafc;\">")
    table_lines.append("          <td style=\"padding: 16px; text-align: left; font-weight: 600; color: #334155;\">Disponibilidad</td>")
    for p in products:
        cta_url = html.escape(p.affiliate_url or "#")
        cta_text = html.escape(p.cta_text or "Ver Oferta")
        table_lines.append("          <td style=\"padding: 16px;\">")
        table_lines.append(f"            <a href=\"{cta_url}\" target=\"_blank\" rel=\"nofollow sponsored noopener\" style=\"display: inline-block; width: 100%; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; padding: 10px 16px; border-radius: 8px; text-decoration: none; box-sizing: border-box; text-align: center; box-shadow: 0 2px 4px rgba(249,115,22,0.3);\">")
        table_lines.append(f"              {cta_text} &rarr;")
        table_lines.append("            </a>")
        table_lines.append("          </td>")
    table_lines.append("        </tr>")
    table_lines.append("      </tbody>")
    table_lines.append("    </table>")
    table_lines.append("  </div>")
    table_lines.append("</div>")
    table_lines.append("<!-- TABLA COMPARATIVA SEO CRM - FIN -->")

    html_table = "\n".join(table_lines)

    # 3. Build Preview Cards Grid
    cards_lines: list[str] = []
    cards_lines.append("<div class=\"seo-comparison-cards\" style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin: 24px 0;\">")
    for p in products:
        p_name = html.escape(p.name)
        p_badge = html.escape(p.badge) if p.badge else ""
        badge_html = f"<span style=\"position: absolute; top: -10px; right: 16px; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;\">{p_badge}</span>" if p_badge else ""
        price_text = html.escape(p.price) if p.price else "Consultar precio"
        cta_url = html.escape(p.affiliate_url or "#")
        cta_text = html.escape(p.cta_text or "Ver Mejor Precio")

        specs_html = "".join([f"<div style=\"display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px solid #f1f5f9; padding: 4px 0;\"><span style=\"color: #64748b;\">{html.escape(k)}</span><strong style=\"color: #0f172a;\">{html.escape(v)}</strong></div>" for k, v in list(p.specs.items())[:4]])
        pros_html = "".join([f"<li style=\"color: #166534; font-size: 12px; margin-bottom: 2px;\">&#10003; {html.escape(pro)}</li>" for pro in p.pros[:2]])

        cards_lines.append("  <div style=\"position: relative; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;\">")
        cards_lines.append("    <div>")
        if badge_html:
            cards_lines.append(f"      {badge_html}")
        cards_lines.append(f"      <h3 style=\"font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; margin-bottom: 8px;\">{p_name}</h3>")
        cards_lines.append(f"      <div style=\"font-size: 20px; font-weight: 800; color: #059669; margin-bottom: 12px;\">{price_text}</div>")
        if specs_html:
            cards_lines.append(f"      <div style=\"margin-bottom: 12px;\">{specs_html}</div>")
        if pros_html:
            cards_lines.append(f"      <ul style=\"list-style: none; padding-left: 0; margin: 0 0 16px 0;\">{pros_html}</ul>")
        cards_lines.append("    </div>")
        cards_lines.append(f"    <a href=\"{cta_url}\" target=\"_blank\" rel=\"nofollow sponsored noopener\" style=\"display: block; background: #f97316; color: #ffffff; text-align: center; padding: 10px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 13px;\">")
        cards_lines.append(f"      {cta_text} &rarr;")
        cards_lines.append("    </a>")
        cards_lines.append("  </div>")

    cards_lines.append("</div>")
    preview_cards_html = "\n".join(cards_lines)

    return ComparisonTableGenerateResponse(
        html_table=html_table,
        preview_cards_html=preview_cards_html,
        spec_columns=spec_keys,
        products_count=len(products),
    )