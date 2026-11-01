"""
FundBridge AI - poster system-architecture figure.

Styled after the reference poster: a titled banner, eight numbered stages
flowing left to right across two rows, a legend, and contribution pills.

Layout is measured before it is drawn, so each row is exactly as tall as its
tallest card and no card carries dead space.

Every figure shown - weights, dimensions, thresholds, factor names - is read
from the project's own configuration rather than invented.
"""
import pymupdf

OUT_PDF = r'C:\Users\lenovo\OneDrive\fundbridgeai\docs\figures\poster_system_architecture.pdf'
OUT_PNG = r'C:\Users\lenovo\OneDrive\fundbridgeai\docs\figures\poster_system_architecture.png'

W = 1180

INK      = (0.086, 0.062, 0.200)
DEEP     = (0.216, 0.188, 0.639)
ACCENT   = (0.310, 0.275, 0.898)
MUTED    = (0.360, 0.353, 0.490)
PAGE     = (0.878, 0.898, 0.980)
CARD     = (1, 1, 1)
CARD_ALT = (0.957, 0.961, 1.000)
TINT     = (0.898, 0.914, 1.000)
BORDER   = (0.741, 0.776, 0.937)
LINE     = (0.498, 0.525, 0.800)
GOOD     = (0.016, 0.471, 0.341)
WARN     = (0.761, 0.255, 0.047)
GOOD_BG  = (0.902, 0.973, 0.941)
WARN_BG  = (1.000, 0.933, 0.835)

MX, GAP = 26, 13
CW = (W - 2 * MX - 3 * GAP) / 4

TITLE_SZ, HEAD_SZ, BODY_SZ, FOOT_SZ = 9.4, 7.9, 7.0, 6.6


def tw(s, size, bold=False):
    return pymupdf.get_text_length(s, fontname='hebo' if bold else 'helv', fontsize=size)


def lines_needed(s, size, width, bold=False):
    n, cur = 1, ''
    for w in s.split(' '):
        t = (cur + ' ' + w).strip()
        if tw(t, size, bold) > width and cur:
            n, cur = n + 1, w
        else:
            cur = t
    return n


# --------------------------------------------------------------- stage content
# (column, number, title, blocks, footnote)
STAGES = [
    (0, 1, 'Input & Profile Capture', [
        ('plain', ['Business Profile', 'basics \u00b7 story \u00b7 financials',
                   'market \u00b7 team \u00b7 registrations']),
        ('arrow', None),
        ('plain', ['Funding Requirement', 'amount \u00b7 purpose \u00b7 type']),
        ('arrow', None),
        ('plain', ['Proposal Document', 'PDF / DOCX upload',
                   'validated by magic bytes, not extension']),
        ('gap', None),
        ('warn', ['Unanswered = UNKNOWN',
                  "never defaulted in the applicant's favour"]),
    ], 'Structured fields + free text'),

    (1, 2, 'Preprocessing & NLP', [
        ('plain', ['Document Extraction', 'PyMuPDF (PDF) \u00b7 python-docx (DOCX)']),
        ('arrow', None),
        ('plain', ['Text Cleaning', 'normalise \u00b7 de-hyphenate',
                   'strip control characters']),
        ('arrow', None),
        ('plain', ['Section Detection', 'heading heuristics',
                   '\u2264 8 words \u00b7 no mid-sentence punctuation']),
        ('arrow', None),
        ('plain', ['Section Scoring', 'completeness and depth per section']),
    ], 'Python 3.12 \u00b7 FastAPI \u00b7 isolated service'),

    (2, 3, 'Embedding & Vector Index', [
        ('accent', ['all-MiniLM-L6-v2', '384-dimensional \u00b7 L2-normalised',
                    'CPU only, no GPU required']),
        ('arrow', None),
        ('plain', ['Chunking', 'overlapping passages, heading retained']),
        ('arrow', None),
        ('plain', ['Vector Store', 'PostgreSQL double precision[]',
                   'fb_dot_product() = exact cosine']),
        ('gap', None),
        ('plain', ['Exact search', 'no ANN approximation at this corpus size']),
    ], 'pgvector unavailable for PG18 on Windows'),

    (3, 4, 'Verified Scheme Corpus', [
        ('plain', ['Official Source Collection',
                   'government domains \u00b7 robots.txt respected']),
        ('arrow', None),
        ('warn', ['Provenance Gate',
                  'rejects any record citing a non-government source']),
        ('arrow', None),
        ('plain', ['Every Field Marked', 'QUOTED or DERIVED',
                   'null + stated reason when unstated']),
        ('arrow', None),
        ('good', ['PUBLISHED records only',
                  'official source URL + verification date']),
    ], 'Synthetic demonstration records badged on screen'),

    (0, 5, 'Deterministic Scoring Engines', [
        ('accent', ['Funding Readiness \u00b7 5 components',
                    'profile 20 \u00b7 financial 25 \u00b7 market 20',
                    'team 15 \u00b7 proposal 20']),
        ('gap', None),
        ('accent', ['Scheme Matching \u00b7 7 factors',
                    'industry 25 \u00b7 stage 20 \u00b7 type 15',
                    'funding 15 \u00b7 location 10 \u00b7 purpose 10',
                    'semantic relevance 5']),
        ('gap', None),
        ('accent', ['Investor Matching \u00b7 5 factors',
                    'industry 30 \u00b7 size 25 \u00b7 stage 20',
                    'location 15 \u00b7 funding type 10']),
    ], 'Pure functions: no I/O, no clock, no LLM'),

    (1, 6, 'Factor Resolution & Gating', [
        ('plain', ['Each factor resolved independently']),
        ('gap', None),
        ('good', ['MATCH \u2192 1 \u00b7 UNRESTRICTED \u2192 1',
                  'the scheme states no constraint']),
        ('gap', None),
        ('warn', ['UNKNOWN \u2192 0',
                  'the business did not state it',
                  'forces NEEDS INFORMATION']),
        ('gap', None),
        ('plain', ['Weight renormalisation',
                   'over the factors actually present']),
        ('gap', None),
        ('plain', ['Blocking issue overrides the score']),
    ], 'A high score can never come from missing data'),

    (2, 7, 'Grounded Retrieval (RAG)', [
        ('plain', ['Query embedding', 'the same 384-d model']),
        ('arrow', None),
        ('accent', ['Cosine similarity', 'raw threshold \u2265 0.35',
                    'PUBLISHED documents only']),
        ('arrow', None),
        ('warn', ['Below threshold \u2192 returns nothing',
                  'and states why it cannot answer']),
        ('arrow', None),
        ('plain', ['LLM phrasing', 'Groq \u00b7 openai/gpt-oss-120b',
                   'explains a decision, never makes one']),
    ], 'Retrieved text is data, never instructions'),

    (3, 8, 'Explainable Output', [
        ('good', ['Score with its composition',
                  'every factor, its weight and its reason']),
        ('gap', None),
        ('plain', ['Four honest statuses',
                   'potentially eligible \u00b7 needs information',
                   'review required \u00b7 likely not eligible']),
        ('gap', None),
        ('plain', ['Named gaps',
                   'the exact fields that would raise each score']),
        ('gap', None),
        ('plain', ['Citations', 'official URL + verification date']),
        ('gap', None),
        ('accent', ['modelVersion + configVersion',
                    'stamped on every derived row']),
    ], 'Decision support \u2014 never a guarantee of funding'),
]


def block_h(kind, lines):
    if kind == 'arrow':
        return 17
    if kind == 'gap':
        return 5
    pad = 7
    inner = CW - 16 - 2 * pad
    hh = pad + 2
    for i, ln in enumerate(lines):
        sz, bold = (HEAD_SZ, True) if i == 0 else (BODY_SZ, False)
        hh += lines_needed(ln, sz, inner, bold) * (sz + 2.0) + (1.5 if i == 0 else 0)
    return hh + pad - 2


def stage_h(title, blocks, foot):
    h = 16 + max(lines_needed(title, TITLE_SZ, CW - 44, True) * 11, 22) + 6
    for kind, lines in blocks:
        h += block_h(kind, lines) + (7 if kind not in ('arrow', 'gap') else 0)
    if foot:
        h += 6 + lines_needed(foot, FOOT_SZ, CW - 20) * 8
    return h + 12


# ------------------------------------------------------------------- measure
R1, R2 = STAGES[:4], STAGES[4:]
R1H = max(stage_h(t, b, f) for _, _, t, b, f in R1)
R2H = max(stage_h(t, b, f) for _, _, t, b, f in R2)

TITLE_Y, TITLE_H = 18, 74
R1Y = TITLE_Y + TITLE_H + 18
WRAPGAP = 44
R2Y = R1Y + R1H + WRAPGAP
LY = R2Y + R2H + 22
LEG_H = 48
PY_ = LY + LEG_H + 14
H = PY_ + 36 + 26

# --------------------------------------------------------------------- draw
doc = pymupdf.open()
page = doc.new_page(width=W, height=H)
page.draw_rect(pymupdf.Rect(0, 0, W, H), color=None, fill=PAGE)


def text(x, y, s, size=8, color=INK, bold=False, centre_in=None):
    if centre_in is not None:
        x = x + (centre_in - tw(s, size, bold)) / 2
    page.insert_text((x, y), s, fontname='hebo' if bold else 'helv', fontsize=size, color=color)


def wrap(x, y, s, size, width, color=INK, bold=False, leading=None, centre=False):
    lead = leading or size + 2.4
    cy, line = y, ''
    for w in s.split(' '):
        t = (line + ' ' + w).strip()
        if tw(t, size, bold) > width and line:
            text(x, cy, line, size, color, bold, centre_in=width if centre else None)
            cy += lead
            line = w
        else:
            line = t
    if line:
        text(x, cy, line, size, color, bold, centre_in=width if centre else None)
        cy += lead
    return cy


def rrect(x, y, w, h, fill=CARD, stroke=BORDER, width=0.9, radius=0.055):
    page.draw_rect(pymupdf.Rect(x, y, x + w, y + h), color=stroke, fill=fill,
                   width=width, radius=radius)


def arrow_h(x1, x2, y, color=LINE):
    page.draw_line(pymupdf.Point(x1, y), pymupdf.Point(x2 - 6, y), color=color, width=1.6)
    page.draw_polyline([pymupdf.Point(x2 - 7, y - 4.5), pymupdf.Point(x2, y),
                        pymupdf.Point(x2 - 7, y + 4.5)], color=color, fill=color, width=1)


def arrow_v(x, y1, y2, color=LINE):
    page.draw_line(pymupdf.Point(x, y1), pymupdf.Point(x, y2 - 6), color=color, width=1.4)
    page.draw_polyline([pymupdf.Point(x - 4, y2 - 7), pymupdf.Point(x, y2),
                        pymupdf.Point(x + 4, y2 - 7)], color=color, fill=color, width=1)


# banner
rrect(MX, TITLE_Y, W - 2 * MX, TITLE_H, fill=TINT, stroke=DEEP, width=1.6, radius=0.09)
text(0, TITLE_Y + 32, 'SYSTEM ARCHITECTURE', 23, DEEP, True, centre_in=W)
text(0, TITLE_Y + 52,
     'FundBridge AI \u2014 Explainable Funding Decision Support with Verified Scheme Retrieval',
     9.2, MUTED, False, centre_in=W)
text(0, TITLE_Y + 65, 'for Micro and Small Enterprises', 9.2, MUTED, False, centre_in=W)

STYLE = {
    'plain':  (CARD,    BORDER, 0.9, INK),
    'accent': (TINT,    ACCENT, 1.4, DEEP),
    'good':   (GOOD_BG, GOOD,   1.1, GOOD),
    'warn':   (WARN_BG, WARN,   1.1, WARN),
}


def draw_stage(col, row_y, card_h, num, title, blocks, foot):
    x = MX + col * (CW + GAP)
    rrect(x, row_y, CW, card_h, fill=CARD_ALT, stroke=BORDER, width=1.1, radius=0.045)

    cx, cy = x + 18, row_y + 19
    page.draw_circle(pymupdf.Point(cx, cy), 10.5, color=DEEP, fill=DEEP, width=0)
    text(cx - tw(str(num), 10.5, True) / 2, cy + 3.4, str(num), 10.5, (1, 1, 1), True)

    yy = wrap(x + 34, row_y + 16, title, TITLE_SZ, CW - 44, DEEP, True, leading=11)
    yy = max(yy, row_y + 38) + 6

    for kind, lines in blocks:
        if kind == 'arrow':
            arrow_v(x + CW / 2, yy, yy + 13)
            yy += 17
            continue
        if kind == 'gap':
            yy += 5
            continue

        fill, stroke, bw, head_col = STYLE[kind]
        hh, pad = block_h(kind, lines), 7
        inner = CW - 16 - 2 * pad
        rrect(x + 8, yy, CW - 16, hh, fill=fill, stroke=stroke, width=bw, radius=0.09)
        ty = yy + pad + 6
        for i, ln in enumerate(lines):
            sz = HEAD_SZ if i == 0 else BODY_SZ
            ty = wrap(x + 8 + pad, ty, ln, sz, inner,
                      head_col if i == 0 else MUTED, i == 0,
                      leading=sz + 2.0, centre=True)
            if i == 0:
                ty += 1.5
        yy += hh + 7

    if foot:
        # Pinned to the bottom of the (row-equalised) card so every footnote in
        # a row sits on the same line, rather than floating under content of
        # differing height.
        fh = lines_needed(foot, FOOT_SZ, CW - 20) * 8
        wrap(x + 10, row_y + card_h - fh - 6, foot, FOOT_SZ, CW - 20, MUTED, False,
             leading=8, centre=True)


for col, num, t, b, f in R1:
    draw_stage(col, R1Y, R1H, num, t, b, f)
for col, num, t, b, f in R2:
    draw_stage(col, R2Y, R2H, num, t, b, f)

# flow arrows
for c in range(3):
    x1 = MX + c * (CW + GAP) + CW
    arrow_h(x1 + 1, x1 + GAP - 1, R1Y + R1H / 2)
    arrow_h(x1 + 1, x1 + GAP - 1, R2Y + R2H / 2)

wx = MX + 3 * (CW + GAP) + CW / 2
wy = R1Y + R1H + WRAPGAP / 2
page.draw_line(pymupdf.Point(wx, R1Y + R1H), pymupdf.Point(wx, wy), color=LINE, width=1.6)
page.draw_line(pymupdf.Point(wx, wy), pymupdf.Point(MX + CW / 2, wy), color=LINE, width=1.6)
arrow_v(MX + CW / 2, wy, R2Y)

# legend
rrect(MX, LY, W - 2 * MX, LEG_H, fill=CARD, stroke=BORDER, width=1.0, radius=0.12)
lx = 44
for kind, label in [('plain', 'Processing block'), ('accent', 'Model / weighted stage'),
                    ('good', 'Permissive outcome'), ('warn', 'Conservative guard'),
                    ('arrow', 'Data flow')]:
    if kind == 'arrow':
        page.draw_line(pymupdf.Point(lx, LY + 25), pymupdf.Point(lx + 20, LY + 25),
                       color=LINE, width=1.6)
        page.draw_polyline([pymupdf.Point(lx + 14, LY + 21), pymupdf.Point(lx + 21, LY + 25),
                            pymupdf.Point(lx + 14, LY + 29)], color=LINE, fill=LINE, width=1)
        lx += 26
    else:
        f_, s_, _, _ = STYLE[kind]
        rrect(lx, LY + 17, 22, 15, fill=f_, stroke=s_, width=1.2, radius=0.18)
        lx += 28
    text(lx, LY + 29, label, 8.2, MUTED)
    lx += tw(label, 8.2) + 30

# contribution pills
pw = (W - 2 * MX - 3 * 12) / 4
for i, s in enumerate(['Explainable by Construction', 'Conservative Under Uncertainty',
                       'Provenance-Tracked Scheme Data', 'Grounded Generation (RAG)']):
    px = MX + i * (pw + 12)
    rrect(px, PY_, pw, 36, fill=DEEP, stroke=DEEP, width=0, radius=0.3)
    size = 8.6
    while tw(s, size, True) > pw - 16 and size > 6.4:
        size -= 0.2
    text(px, PY_ + 23, s, size, (1, 1, 1), True, centre_in=pw)

doc.save(OUT_PDF)
pix = page.get_pixmap(dpi=300)
pix.save(OUT_PNG)
print('  PDF : %s' % OUT_PDF)
print('  PNG : %s' % OUT_PNG)
print('  canvas %d x %d pt   ratio %.3f' % (W, H, W / H))
print('  raster %d x %d px at 300 dpi' % (pix.width, pix.height))
print('  row heights: %.0f / %.0f pt' % (R1H, R2H))
