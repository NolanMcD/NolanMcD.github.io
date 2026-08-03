"""Build the three committed resume PDFs from _data/resumes.json."""
from __future__ import annotations

import html
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "_data" / "resumes.json").read_text(encoding="utf-8"))
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
OUTPUT = ROOT / "assets" / "resumes"

FILENAMES = {
    "software": "nolan-mcdermott-software-engineering.pdf",
    "data": "nolan-mcdermott-data-analytics.pdf",
    "ai": "nolan-mcdermott-applied-ai.pdf",
}

CSS = """
@page{size:Letter;margin:.42in}*{box-sizing:border-box}body{margin:0;color:#201d1b;font:8.35pt/1.24 Arial,Helvetica,sans-serif}.header{display:flex;justify-content:space-between;gap:24px;padding-bottom:6pt;border-bottom:3px solid #241f1c}.kicker{margin:0 0 4pt;color:#a32620;font-size:6.5pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;color:#241f1c;font-size:25pt;line-height:1;letter-spacing:-.045em;text-transform:uppercase}.role{margin:4pt 0 0;color:#68615c;font-weight:700}address{flex:0 0 175px;font-size:7.4pt;font-style:normal;line-height:1.45;text-align:right}a{color:inherit;text-decoration:none}section{margin-top:7pt;break-inside:avoid}h2{margin:0 0 4pt;padding-bottom:2pt;border-bottom:1px solid #b9b3aa;color:#a32620;font-size:7.2pt;letter-spacing:.13em;text-transform:uppercase}.summary p{margin:0}.heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.heading h3{margin:0;color:#241f1c;font-size:8.8pt}.heading p,.detail{margin:1pt 0 0;color:#68615c;font-size:7.5pt}.heading time{flex:0 0 auto;color:#68615c;font-size:7.3pt;font-weight:700}ul{margin:3pt 0 0;padding-left:13pt}li{margin:1.1pt 0;padding-left:1pt}.entry+.entry{margin-top:5pt}.columns{display:grid;grid-template-columns:.8fr 1.35fr;gap:14pt}dl,dl div{margin:0}dl div{display:grid;grid-template-columns:74px 1fr;gap:3pt;margin-bottom:1.5pt}dt{font-weight:800}dd{margin:0}.final p{margin:2pt 0}
"""


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def document(resume: dict) -> str:
    skills = "".join(f"<div><dt>{esc(x['label'])}</dt><dd>{esc(x['value'])}</dd></div>" for x in resume["skills"])
    bullets = "".join(f"<li>{esc(x)}</li>" for x in resume["millennium"])
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Nolan McDermott — {esc(resume['label'])}</title><style>{CSS}</style></head><body>
<header class="header"><div><p class="kicker">{esc(resume['label'])}</p><h1>Nolan McDermott</h1><p class="role">{esc(resume['title'])}</p></div><address>Miami, Florida<br>(516) 554-7741<br>boltjets24@gmail.com<br>linkedin.com/in/nolan-mcdermott-b9a20220b<br>github.com/NolanMcD</address></header>
<section class="summary"><h2>Profile</h2><p>{esc(resume['summary'])}</p></section>
<section><h2>Professional Experience</h2><div class="entry"><div class="heading"><div><h3>Software Engineer</h3><p>Millennium Management · Miami, FL</p></div><time>Aug 2022 – May 2025</time></div><ul>{bullets}</ul></div>
<div class="entry"><div class="heading"><div><h3>Federation of Club Sports Council Member</h3><p>Herbert Wellness Center · University of Miami</p></div><time>Aug 2021 – May 2022</time></div><ul><li>Managed and allocated a $75,000+ annual budget across multiple club sport organizations.</li><li>Coordinated with club presidents to plan events, approve funding, resolve operational issues, and support online member services.</li></ul></div></section>
<div class="columns"><section><h2>Education</h2><div class="heading"><div><h3>University of Miami</h3><p>B.S. Computer Science & Mathematics</p></div><time>Jun 2022</time></div><p class="detail">GPA: 3.83 · Miami, FL</p></section><section><h2>Technical Skills</h2><dl>{skills}</dl></section></div>
<section class="final"><h2>Leadership & Communication</h2><p><strong>President, University of Miami Club Running.</strong> Led team operations, practices, events, and member communication; represented club interests at the university council level.</p><p>Experienced translating technical work for non-technical stakeholders and helping coworkers learn computer science concepts, new systems, and remote development environments.</p></section></body></html>"""


def main() -> None:
    if not EDGE.exists():
        raise SystemExit(f"Microsoft Edge was not found at {EDGE}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="noland-resumes-") as temp:
        temp_dir = Path(temp)
        browser_profile = temp_dir / "browser-profile"
        for lane, resume in DATA.items():
            source = temp_dir / f"{lane}.html"
            target = OUTPUT / FILENAMES[lane]
            source.write_text(document(resume), encoding="utf-8")
            subprocess.run([
                str(EDGE), "--headless", "--disable-gpu", "--no-pdf-header-footer",
                "--no-first-run", f"--user-data-dir={browser_profile}",
                f"--print-to-pdf={target}", source.as_uri()
            ], check=True, capture_output=True)
            print(f"Built {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
