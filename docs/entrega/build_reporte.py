"""Genera Reporte_Tecnico_SOKKO.docx y .pdf a partir de REPORTE_TECNICO.md.

Uso (desde la raíz del repo):
    python docs/entrega/build_reporte.py
    python docs/entrega/build_reporte.py --plantilla RUTA/plantilla_portada.docx --sin-pdf

Requisitos: python-docx y docx2pdf (pip install python-docx docx2pdf), Microsoft Word en Windows para el índice y el
PDF, y Node.js para exportar los diagramas Mermaid a PNG con @mermaid-js/mermaid-cli (o la variable MMDC con la ruta
de un `mmdc` ya instalado).

Datos personales: las matrículas se leen de docs/entrega/datos_equipo.local.json, que no se sube al repositorio.
La salida (.docx, .pdf y diagramas) queda en docs/entrega/salida/, también fuera de Git.

Formato de datos_equipo.local.json (fecha_entrega es opcional, AAAA-MM-DD; sin ella se usa la fecha de hoy):
    {"integrantes": [{"nombre": "...", "matricula": "..."}], "docente": "...", "institucion": "...",
     "carrera": "...", "semestre": "...", "grupo": "...", "asignatura": "...", "fecha_entrega": "2026-11-05"}

La plantilla de portada se lee de docs/entrega/salida/plantilla_portada.docx (o de --plantilla).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
FUENTE_MD = AQUI / "REPORTE_TECNICO.md"
DATOS = AQUI / "datos_equipo.local.json"
SALIDA = AQUI / "salida"
NOMBRE = "Reporte_Tecnico_SOKKO"
MERMAID_CLI = "@mermaid-js/mermaid-cli@11.4.2"
MERMAID_CONFIG = json.dumps({
    "theme": "neutral",
    "themeVariables": {"fontFamily": "Arial", "fontSize": "18px"},
    "sequence": {"actorFontSize": 18, "messageFontSize": 18, "noteFontSize": 16, "mirrorActors": False,
                 "useMaxWidth": False},
    "flowchart": {"useMaxWidth": False},
    "er": {"fontSize": 16, "useMaxWidth": False},
})

FUENTE = "Arial"
MONO = "Consolas"
TINTA = RGBColor(0x23, 0x21, 0x1E)
TINTA_SUAVE = RGBColor(0x6A, 0x64, 0x5C)
ANCHO_UTIL_CM = 21.59 - 2 * 2.5
ALTO_MAX_IMAGEN_CM = 9.5
ANCHO_CAPTURA_CM = 12.5
ALTO_MAX_DIAGRAMA_CM = 14

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]


# ---------------------------------------------------------------- utilidades de XML


def _set(el, tag: str, **attrs) -> OxmlElement:
    """Agrega (o reutiliza) el hijo `tag` de `el` con los atributos dados."""
    child = el.find(qn(tag))
    if child is None:
        child = OxmlElement(tag)
        el.append(child)
    for key, value in attrs.items():
        child.set(qn(f"w:{key}"), str(value))
    return child


def add_field(paragraph, instr: str, placeholder: str = "") -> None:
    """Inserta un campo de Word (PAGE, TOC…) en el párrafo."""
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    begin.set(qn("w:dirty"), "true")
    run._r.append(begin)
    run = paragraph.add_run()
    text = OxmlElement("w:instrText")
    text.set(qn("xml:space"), "preserve")
    text.text = f" {instr} "
    run._r.append(text)
    run = paragraph.add_run()
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    run._r.append(sep)
    paragraph.add_run(placeholder)
    run = paragraph.add_run()
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(end)


def shade(cell, fill: str) -> None:
    _set(cell._tc.get_or_add_tcPr(), "w:shd", val="clear", color="auto", fill=fill)


def table_borders(table, color: str = "BFB8AE") -> None:
    tbl_pr = table._tbl.tblPr
    borders = _set(tbl_pr, "w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        _set(borders, f"w:{side}", val="single", sz="4", space="0", color=color)
    _set(tbl_pr, "w:tblW", w="5000", type="pct")
    margins = _set(tbl_pr, "w:tblCellMar")
    for side, value in (("top", 40), ("bottom", 40), ("left", 90), ("right", 90)):
        _set(margins, f"w:{side}", w=value, type="dxa")


def repeat_header(row) -> None:
    _set(row._tr.get_or_add_trPr(), "w:tblHeader", val="true")


def cant_split(row) -> None:
    _set(row._tr.get_or_add_trPr(), "w:cantSplit", val="true")


# ---------------------------------------------------------------- estilos


def configure_styles(doc: Document) -> None:
    styles = doc.styles
    body = styles["Reporte"] if "Reporte" in [s.name for s in styles] else styles.add_style("Reporte", 1)
    body.font.name = FUENTE
    body.font.size = Pt(11)
    body.font.color.rgb = TINTA
    body.element.rPr.rFonts.set(qn("w:eastAsia"), FUENTE)
    fmt = body.paragraph_format
    fmt.line_spacing = 1.15
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(6)
    fmt.widow_control = True

    for level, size, before, after in ((1, 16, 18, 8), (2, 13, 12, 6), (3, 11.5, 10, 4)):
        style = styles[f"Heading {level}"]
        style.base_style = None
        style.font.name = FUENTE
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.italic = False
        style.font.color.rgb = TINTA
        rpr = style.element.get_or_add_rPr()
        rpr.get_or_add_rFonts().set(qn("w:ascii"), FUENTE)
        rpr.get_or_add_rFonts().set(qn("w:hAnsi"), FUENTE)
        rpr.get_or_add_rFonts().set(qn("w:eastAsia"), FUENTE)
        pf = style.paragraph_format
        pf.space_before = Pt(before)
        pf.space_after = Pt(after)
        pf.line_spacing = 1.15
        pf.keep_with_next = True
        pf.keep_together = True
        pf.widow_control = True
        _set(style.element.get_or_add_pPr(), "w:outlineLvl", val=level - 1)


# ---------------------------------------------------------------- texto con formato en línea

INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*\s][^*]*\*)")


def add_inline(paragraph, text: str, size: float | None = None, bold: bool = False) -> None:
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            add_inline(paragraph, part[2:-2], size=size, bold=True)
            continue
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = MONO
            run._r.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), MONO)
            run.font.size = Pt((size or 11) - 1)
            if bold:
                run.bold = True
            continue
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            run = paragraph.add_run(part)
        if bold:
            run.bold = True
        if size:
            run.font.size = Pt(size)


# ---------------------------------------------------------------- diagramas Mermaid


def mmdc_command() -> list[str]:
    if os.environ.get("MMDC"):
        return [os.environ["MMDC"]]
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        sys.exit("No se encontró npx: instale Node.js o defina MMDC con la ruta de mmdc.")
    return [npx, "--yes", "-p", MERMAID_CLI, "mmdc"]


def render_mermaid(code: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha1((code + MERMAID_CONFIG).encode("utf-8")).hexdigest()[:12]
    png = out_dir / f"diagrama-{digest}.png"
    if png.exists():
        return png
    src = out_dir / f"diagrama-{digest}.mmd"
    src.write_text(code, encoding="utf-8")
    config = out_dir / "mermaid-config.json"
    config.write_text(MERMAID_CONFIG, encoding="utf-8")
    cmd = mmdc_command() + ["-i", str(src), "-o", str(png), "-w", "1000", "-s", "3", "-b", "white", "-c", str(config)]
    subprocess.run(cmd, check=True, shell=False)
    return png


# ---------------------------------------------------------------- bloques del Markdown


def add_picture(doc: Document, path: Path, caption: str | None, width_cm: float = ANCHO_UTIL_CM,
                max_height_cm: float = ALTO_MAX_IMAGEN_CM) -> None:
    p = doc.add_paragraph(style="Reporte")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(6)
    shape = p.add_run().add_picture(str(path), width=Cm(width_cm))
    if shape.height > Cm(max_height_cm):
        ratio = Cm(max_height_cm) / shape.height
        shape.height = Cm(max_height_cm)
        shape.width = int(shape.width * ratio)
    if caption:
        c = doc.add_paragraph(style="Reporte")
        c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        c.paragraph_format.space_after = Pt(10)
        add_inline(c, caption, size=9.5)
        for run in c.runs:
            run.italic = True
            run.font.color.rgb = TINTA_SUAVE


def add_table(doc: Document, rows: list[list[str]]) -> None:
    header, body = rows[0], rows[1:]
    table = doc.add_table(rows=1 + len(body), cols=len(header))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table_borders(table)
    _set(table._tbl.tblPr, "w:tblLayout", type="fixed")
    widths = column_widths([header] + body, len(header))
    for r, values in enumerate([header] + body):
        row = table.rows[r]
        cant_split(row)
        if r == 0:
            repeat_header(row)
        # Tablas cortas: completas en una página. Largas: al menos el encabezado y dos filas juntos.
        together = r < len(body) and (len(body) <= 12 or r < 3)
        for c, value in enumerate(values[: len(header)]):
            cell = row.cells[c]
            cell.width = widths[c]
            cell.text = ""
            p = cell.paragraphs[0]
            p.style = doc.styles["Reporte"]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.keep_with_next = together
            add_inline(p, value, size=9, bold=(r == 0))
            if r == 0:
                shade(cell, "ECE5DC")
    spacer = doc.add_paragraph(style="Reporte")
    spacer.paragraph_format.space_after = Pt(4)


def column_widths(rows: list[list[str]], cols: int) -> list:
    """Ancho de cada columna proporcional a su texto más largo (con mínimo y máximo), sobre el ancho útil."""
    weights = []
    for c in range(cols):
        longest = max(len(re.sub(r"[`*]", "", row[c])) if c < len(row) else 0 for row in rows)
        weights.append(min(max(longest, 13), 60))
    total = sum(weights)
    return [Cm(ANCHO_UTIL_CM * w / total) for w in weights]


def split_row(line: str) -> list[str]:
    cells, current, in_code = [], "", False
    for ch in line.strip().strip("|"):
        if ch == "`":
            in_code = not in_code
        if ch == "|" and not in_code:
            cells.append(current.strip())
            current = ""
        else:
            current += ch
    cells.append(current.strip())
    return cells


def add_list_item(doc: Document, marker: str, text: str) -> None:
    p = doc.add_paragraph(style="Reporte")
    pf = p.paragraph_format
    pf.left_indent = Cm(0.9)
    pf.first_line_indent = Cm(-0.5)
    pf.space_after = Pt(3)
    p.add_run(f"{marker}\t")
    _set(_set(p._p.get_or_add_pPr(), "w:tabs"), "w:tab", val="left", pos=str(Cm(0.9).twips))
    add_inline(p, text)


def render_markdown(doc: Document, md: str, diagrams: Path) -> None:
    lines = md.splitlines()
    # Lo anterior al primer "## " (título, datos del equipo y nota de la fuente) ya está en la portada.
    start = next(i for i, line in enumerate(lines) if line.startswith("## "))
    i = start
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            p = doc.add_paragraph(style="Reporte")
            text = " ".join(paragraph)
            add_inline(p, text)
            # Un párrafo que presenta una tabla o lista no se queda solo al final de la página.
            if text.endswith(":") or text.endswith(".**"):
                p.paragraph_format.keep_with_next = True
            paragraph.clear()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("```"):
            flush()
            lang = stripped[3:].strip()
            block = []
            i += 1
            while not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            code = "\n".join(block)
            if lang == "mermaid":
                add_picture(doc, render_mermaid(code, diagrams), None, ANCHO_UTIL_CM, ALTO_MAX_DIAGRAMA_CM)
            else:
                p = doc.add_paragraph(style="Reporte")
                run = p.add_run(code)
                run.font.name = MONO
                run.font.size = Pt(9)
        elif stripped.startswith("## "):
            flush()
            doc.add_heading(stripped[3:], level=1)
        elif stripped.startswith("### "):
            flush()
            doc.add_heading(stripped[4:], level=2)
        elif stripped.startswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = split_row(lines[i])
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            add_table(doc, rows)
            continue
        elif stripped.startswith("!["):
            flush()
            m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
            caption = None
            if i + 2 < len(lines) and lines[i + 1].strip() == "" and lines[i + 2].strip().startswith("*Figura"):
                caption = lines[i + 2].strip().strip("*")
                i += 2
            add_picture(doc, (FUENTE_MD.parent / m.group(2)).resolve(), caption, ANCHO_CAPTURA_CM)
        elif re.match(r"^- ", stripped):
            flush()
            add_list_item(doc, "•", stripped[2:])
        elif re.match(r"^\d+\. ", stripped):
            flush()
            number, text = stripped.split(" ", 1)
            add_list_item(doc, number, text)
        elif stripped.startswith(">"):
            flush()
        elif stripped == "":
            flush()
        else:
            paragraph.append(stripped)
        i += 1
    flush()


# ---------------------------------------------------------------- portada


def fecha_larga(fecha: dt.date) -> str:
    return f"{fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def fill_template_cover(doc: Document, datos: dict, fecha: str) -> None:
    """Llena los campos de la plantilla institucional sin cambiar su formato (se reemplaza el texto de cada run)."""
    nombres = [x["nombre"] for x in datos["integrantes"]]
    matriculas = [x["matricula"] for x in datos["integrantes"]]
    valores = {
        "Alumno:": ("Alumnos:", "\n".join(nombres)),
        "Matrícula:": ("Matrículas:", " · ".join(matriculas)),
        "Grado y grupo:": (None, f"{datos['semestre']}, {datos['grupo']}\n{datos['carrera']}"),
        "Asignatura:": (None, datos["asignatura"]),
        "Actividad:": (None, "Reporte técnico del proyecto integrador SOKKO\nEquipo NEXUS CODE"),
        "Maestro:": ("Docente:", datos["docente"]),
    }
    paragraphs = doc.paragraphs
    for idx, p in enumerate(paragraphs):
        label = p.text.strip()
        if label in valores and idx + 1 < len(paragraphs):
            nuevo_label, valor = valores[label]
            if nuevo_label:
                set_runs(p, nuevo_label)
            set_runs(paragraphs[idx + 1], valor)
        elif label.startswith("Ciudad, Estado"):
            set_runs(p, f"Los Mochis, Sinaloa, {fecha}")
    # Con cuatro integrantes, un renglón vacío entre bloques basta para que la portada quede en una página.
    for idx in range(len(paragraphs) - 1, 0, -1):
        p, prev = paragraphs[idx], paragraphs[idx - 1]
        if idx > 14 and not p.text.strip() and not prev.text.strip() and not p._p.xpath(".//w:drawing"):
            p._p.getparent().remove(p._p)


def set_runs(paragraph, text: str) -> None:
    runs = paragraph.runs
    runs[0].text = text
    for run in runs[1:]:
        run.text = ""


def simple_cover(doc: Document, datos: dict, fecha: str) -> None:
    def line(text, size=12, bold=False, space=6):
        p = doc.add_paragraph(style="Reporte")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(space)
        run = p.add_run(text)
        run.font.size = Pt(size)
        run.bold = bold
        return p

    line(datos["institucion"], 16, True, 24)
    logo = RAIZ / "docs" / "brand" / "sokko-logo-1920.png"
    if logo.exists():
        p = doc.add_paragraph(style="Reporte")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(logo), width=Cm(6))
    line("Reporte técnico del proyecto integrador SOKKO", 18, True, 24)
    line(datos["asignatura"], 12)
    line(f"{datos['carrera']} · {datos['semestre']} · {datos['grupo']}", 11, space=24)
    line("Equipo NEXUS CODE", 12, True)
    for x in datos["integrantes"]:
        line(f"{x['nombre']} — {x['matricula']}", 11, space=2)
    line(f"Docente: {datos['docente']}", 11, space=24)
    line(f"Los Mochis, Sinaloa, {fecha}", 11)


# ---------------------------------------------------------------- documento


def start_report_section(doc: Document):
    section = doc.add_section(WD_SECTION.NEW_PAGE)
    sect_pr = section._sectPr
    # La sección nueva hereda las referencias al encabezado de la portada (con el fondo y el logo): se quitan para
    # que el reporte tenga su propio encabezado y pie, sin imágenes.
    for tag in ("w:headerReference", "w:footerReference", "w:titlePg"):
        for el in sect_pr.findall(qn(tag)):
            sect_pr.remove(el)
    section.page_width, section.page_height = Cm(21.59), Cm(27.94)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(section, side, Cm(2.5))
    section.header_distance = Cm(1.25)
    section.footer_distance = Cm(1.25)
    section.different_first_page_header_footer = False

    section.header.is_linked_to_previous = False
    hp = section.header.paragraphs[0]
    hp.style = doc.styles["Reporte"]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = hp.add_run("SOKKO · Reporte técnico")
    run.font.size = Pt(9)
    run.font.color.rgb = TINTA_SUAVE

    section.footer.is_linked_to_previous = False
    fp = section.footer.paragraphs[0]
    fp.style = doc.styles["Reporte"]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_field(fp, "PAGE", "1")
    for r in fp.runs:
        r.font.size = Pt(9)
        r.font.color.rgb = TINTA_SUAVE
    return section


def add_toc(doc: Document) -> None:
    title = doc.add_paragraph(style="Reporte")
    run = title.add_run("Índice")
    run.bold = True
    run.font.size = Pt(16)
    title.paragraph_format.space_after = Pt(12)
    p = doc.add_paragraph(style="Reporte")
    add_field(p, 'TOC \\o "1-2" \\h \\z \\u', "Actualice el índice en Word (F9).")
    doc.add_paragraph(style="Reporte").add_run().add_break(WD_BREAK.PAGE)


def update_fields_and_export(docx_path: Path, pdf: bool) -> Path | None:
    """Actualiza el índice con Word y exporta el PDF con docx2pdf."""
    try:
        import win32com.client  # instalado con docx2pdf en Windows
    except ImportError:
        print("Sin pywin32: el índice se actualiza al abrir el .docx en Word (F9).")
    else:
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        try:
            d = word.Documents.Open(str(docx_path))
            for toc in d.TablesOfContents:
                toc.Update()
            d.Fields.Update()
            for toc in d.TablesOfContents:
                toc.Update()
            d.Save()
            d.Close()
        finally:
            word.Quit()
    if not pdf:
        return None
    from docx2pdf import convert

    pdf_path = docx_path.with_suffix(".pdf")
    convert(str(docx_path), str(pdf_path))
    return pdf_path


def check_pdf(pdf_path: Path) -> None:
    try:
        import pymupdf
    except ImportError:
        return
    doc = pymupdf.open(pdf_path)
    print(f"PDF: {doc.page_count} páginas")
    for n, page in enumerate(doc, start=1):
        text = page.get_text().strip()
        if n > 1 and len(text) < 350 and not page.get_images():
            print(f"  Aviso: la página {n} tiene poco contenido ({len(text)} caracteres).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plantilla", type=Path, default=SALIDA / "plantilla_portada.docx",
                        help="Plantilla de portada institucional (.docx). Sin ella se genera una portada sobria.")
    parser.add_argument("--datos", type=Path, default=DATOS, help="JSON con integrantes y matrículas.")
    parser.add_argument("--salida", type=Path, default=SALIDA)
    parser.add_argument("--sin-pdf", action="store_true", help="Solo genera el .docx.")
    args = parser.parse_args()

    if not args.datos.exists():
        sys.exit(f"Falta {args.datos}. Cree el archivo con el formato descrito al inicio de este script.")
    datos = json.loads(args.datos.read_text(encoding="utf-8"))
    fecha = datos.get("fecha_entrega")
    fecha = fecha_larga(dt.date.fromisoformat(fecha)) if fecha else fecha_larga(dt.date.today())

    args.salida.mkdir(parents=True, exist_ok=True)
    if args.plantilla.exists():
        doc = Document(str(args.plantilla))
        fill_template_cover(doc, datos, fecha)
        configure_styles(doc)
    else:
        print(f"No se encontró la plantilla {args.plantilla}: se genera una portada sobria.")
        doc = Document()
        configure_styles(doc)
        sec = doc.sections[0]
        sec.page_width, sec.page_height = Cm(21.59), Cm(27.94)
        simple_cover(doc, datos, fecha)

    start_report_section(doc)
    add_toc(doc)
    render_markdown(doc, FUENTE_MD.read_text(encoding="utf-8"), args.salida / "diagramas")

    docx_path = (args.salida / f"{NOMBRE}.docx").resolve()
    doc.save(str(docx_path))
    print(f"DOCX: {docx_path}")
    pdf_path = update_fields_and_export(docx_path, pdf=not args.sin_pdf)
    if pdf_path:
        print(f"PDF:  {pdf_path}")
        check_pdf(pdf_path)


if __name__ == "__main__":
    main()
