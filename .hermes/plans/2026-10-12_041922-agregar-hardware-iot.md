# Plan: agregar Raspberry Pi, ESP32 y Arduino

## Goal

Agregar Raspberry Pi, ESP32 y Arduino, con logos locales, a la sección “Tecnologías y áreas de trabajo” del CV web sin alterar su lenguaje visual, accesibilidad, versión móvil ni impresión.

## Current context / assumptions

- Repositorio: `/home/ontos/Escritorio/Proyectos/jose-mercado-cv`.
- Rama actual: `main`, limpia y sincronizada con `origin/main` al iniciar la planificación.
- Último commit observado: `384e836 feat: amplía tecnologías de IA y desarrollo`.
- El sitio es estático y no tiene build: HTML, CSS y JavaScript viven en `index.html`; los logos locales están en `assets/tech/`.
- Producción usa GitHub Pages y el dominio `https://josemercado.cl/`, pero este plan **no incluye push ni despliegue**. Eso requiere una aprobación posterior explícita.
- La sección relevante es `index.html`, líneas aproximadas 415–450, con tres grupos actuales: “Desarrollo y datos”, “Web, infraestructura e identidad” y “Automatización e IA”.
- Cada tecnología reconocible usa el patrón existente `.tag.tech-tag > .tech-logo-box > img.tech-logo`; el nombre visible aporta el texto accesible y el logo decorativo conserva `alt="" aria-hidden="true"`.
- Se asume que Raspberry Pi, ESP32 y Arduino describen experiencia real de José. Si alguna es solamente una tecnología que desea aprender, no publicarla como competencia sin ajustar primero el texto.
- Decisión recomendada: crear un cuarto grupo llamado **“Hardware e IoT”** entre “Web, infraestructura e identidad” y “Automatización e IA”. Es más preciso que mezclar placas y microcontroladores con infraestructura web o IA.
- No modificar CSS: el componente actual ya admite nuevas etiquetas, responsive y formato de impresión.

## Architecture / proposed approach

La implementación será una extensión del catálogo estático existente: tres SVG locales dentro de `assets/tech/` y tres etiquetas en un nuevo grupo de `index.html`. Se añadirá una prueba estándar de Python sin dependencias que valide el contrato del catálogo (grupo, nombres, rutas, existencia y SVG parseable), seguida de verificación estática y visual en navegador. Los logos se descargarán una vez y se servirán localmente para mantener el sitio y el PDF independientes de CDN en tiempo de ejecución.

## Step-by-step tasks

### Task 1 — Crear una prueba de contrato que falle antes de implementar

**Archivos:**

- Crear `tests/test_tech_catalog.py`.

**Contenido completo:**

```python
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

TECHNOLOGIES = {
    "Raspberry Pi": "assets/tech/raspberry-pi.svg",
    "ESP32": "assets/tech/esp32.svg",
    "Arduino": "assets/tech/arduino.svg",
}


class HardwareIotCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = INDEX.read_text(encoding="utf-8")

    def test_hardware_iot_group_exists(self):
        self.assertIn("<h3>Hardware e IoT</h3>", self.html)

    def test_each_technology_uses_the_existing_logo_tag_pattern(self):
        for name, relative_path in TECHNOLOGIES.items():
            expected = (
                '<span class="tag tech-tag"><span class="tech-logo-box">'
                f'<img class="tech-logo" src="{relative_path}" alt="" '
                f'aria-hidden="true"></span>{name}</span>'
            )
            with self.subTest(technology=name):
                self.assertIn(expected, self.html)

    def test_each_logo_is_a_safe_parseable_local_svg(self):
        for name, relative_path in TECHNOLOGIES.items():
            logo = ROOT / relative_path
            with self.subTest(technology=name):
                self.assertTrue(logo.is_file(), f"Missing {relative_path}")
                root = ET.parse(logo).getroot()
                self.assertEqual(root.tag.rsplit("}", 1)[-1], "svg")
                self.assertFalse(
                    any(node.tag.rsplit("}", 1)[-1] == "script" for node in root.iter()),
                    f"Script element found in {relative_path}",
                )


if __name__ == "__main__":
    unittest.main()
```

**Ejecutar:**

```bash
cd /home/ontos/Escritorio/Proyectos/jose-mercado-cv
python3 -m unittest tests/test_tech_catalog.py -v
```

**Resultado esperado antes de implementar:**

- Salida termina en `FAILED`.
- `test_hardware_iot_group_exists` falla porque aún no existe `<h3>Hardware e IoT</h3>`.
- Las comprobaciones de etiquetas o archivos también fallan porque las tres tecnologías todavía no están incorporadas.

No hacer commit mientras la prueba esté roja.

### Task 2 — Incorporar los tres SVG locales

**Archivos a crear:**

- `assets/tech/raspberry-pi.svg`
- `assets/tech/esp32.svg`
- `assets/tech/arduino.svg`

**Descarga reproducible:**

```bash
cd /home/ontos/Escritorio/Proyectos/jose-mercado-cv
curl --fail --location --silent --show-error \
  'https://cdn.jsdelivr.net/npm/simple-icons/icons/raspberrypi.svg' \
  --output assets/tech/raspberry-pi.svg
curl --fail --location --silent --show-error \
  'https://raw.githubusercontent.com/espressif/esp-idf/master/docs/_static/chip-esp32.svg' \
  --output assets/tech/esp32.svg
curl --fail --location --silent --show-error \
  'https://content.arduino.cc/brand/arduino-color.svg' \
  --output assets/tech/arduino.svg
```

**Motivo de las fuentes:**

- ESP32 proviene del repositorio oficial `espressif/esp-idf`.
- Arduino proviene del sitio oficial de identidad de marca de Arduino y se usa de forma descriptiva.
- Raspberry Pi usa el vector mantenido por Simple Icons porque no se encontró un paquete público de branding oficial con una URL SVG estable; revisar visualmente que sea la marca reconocible y no una variante inventada.

**Validar inmediatamente:**

```bash
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
for name in ('raspberry-pi.svg', 'esp32.svg', 'arduino.svg'):
    path = Path('assets/tech') / name
    root = ET.parse(path).getroot()
    assert root.tag.rsplit('}', 1)[-1] == 'svg', name
    assert path.stat().st_size > 100, name
    print(f'OK {name} {path.stat().st_size} bytes')
PY
```

**Resultado esperado:** tres líneas que comienzan con `OK`, una por archivo, y exit code 0. Si alguna URL entrega HTML, XML inválido o un archivo vacío, detenerse y buscar una fuente oficial equivalente; no renombrar PNG/JPEG como `.svg` ni dibujar un logo aproximado.

### Task 3 — Añadir el grupo “Hardware e IoT” al catálogo

**Archivo:** `index.html`.

Insertar el bloque siguiente **después** del cierre del grupo “Web, infraestructura e identidad” (después de la etiqueta `VS Code`) y **antes** del grupo “Automatización e IA”:

```html
            <div class="skills-group"><h3>Hardware e IoT</h3><div class="tags tech-tags">
              <span class="tag tech-tag"><span class="tech-logo-box"><img class="tech-logo" src="assets/tech/raspberry-pi.svg" alt="" aria-hidden="true"></span>Raspberry Pi</span>
              <span class="tag tech-tag"><span class="tech-logo-box"><img class="tech-logo" src="assets/tech/esp32.svg" alt="" aria-hidden="true"></span>ESP32</span>
              <span class="tag tech-tag"><span class="tech-logo-box"><img class="tech-logo" src="assets/tech/arduino.svg" alt="" aria-hidden="true"></span>Arduino</span>
            </div></div>
```

No agregar tarjetas, descripciones, enlaces comerciales ni CSS nuevo. No cambiar el orden de las otras tecnologías.

**Ejecutar la prueba verde:**

```bash
python3 -m unittest tests/test_tech_catalog.py -v
```

**Resultado esperado:**

```text
test_each_logo_is_a_safe_parseable_local_svg ... ok
test_each_technology_uses_the_existing_logo_tag_pattern ... ok
test_hardware_iot_group_exists ... ok
...
OK
```

### Task 4 — Validar el documento y todos los activos tecnológicos

Ejecutar una comprobación de todas las referencias `assets/tech/*.svg`, no solamente las tres nuevas:

```bash
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []
    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            src = dict(attrs).get('src', '')
            if src.startswith('assets/tech/'):
                self.sources.append(src)

root = Path('.')
parser = Images()
parser.feed((root / 'index.html').read_text(encoding='utf-8'))
assert len(parser.sources) == 26, f'Expected 26 tech logo references, got {len(parser.sources)}'
assert len(parser.sources) == len(set(parser.sources)), 'Duplicate tech logo reference found'
for src in parser.sources:
    path = root / src
    assert path.is_file(), f'Missing {src}'
    svg = ET.parse(path).getroot()
    assert svg.tag.rsplit('}', 1)[-1] == 'svg', f'Not SVG: {src}'
print(f'OK: {len(parser.sources)} unique technology logos exist and parse as SVG')
PY
```

**Resultado esperado:**

```text
OK: 26 unique technology logos exist and parse as SVG
```

Comprobar además whitespace y estado:

```bash
git diff --check
git status --short
git diff -- index.html tests/test_tech_catalog.py
git diff --stat
```

**Resultado esperado:**

- `git diff --check` no imprime nada y retorna 0.
- `git status --short` muestra únicamente `index.html`, los tres SVG, `tests/test_tech_catalog.py` y el plan en `.hermes/plans/` si esa carpeta se versiona.
- El diff de `index.html` contiene solamente el nuevo bloque “Hardware e IoT”; no debe haber cambios accidentales de contenido o formato.

### Task 5 — Verificar visualmente escritorio, móvil e impresión

Iniciar un servidor estático local:

```bash
cd /home/ontos/Escritorio/Proyectos/jose-mercado-cv
python3 -m http.server 8765
```

**Resultado esperado:** `Serving HTTP on 0.0.0.0 port 8765 ...` y `http://127.0.0.1:8765/#herramientas` responde HTTP 200.

Abrir `http://127.0.0.1:8765/#herramientas` en navegador y verificar en estos viewports:

- `1440 × 900`
- `1024 × 768`
- `768 × 900`
- `390 × 844`

En la consola del navegador, ejecutar:

```javascript
(() => {
  const expected = ['Raspberry Pi', 'ESP32', 'Arduino'];
  const section = document.querySelector('#herramientas');
  const text = [...section.querySelectorAll('.tech-tag')]
    .map((node) => node.textContent.trim());
  const broken = [...section.querySelectorAll('img.tech-logo')]
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map((img) => img.src);
  return {
    missing: expected.filter((name) => !text.includes(name)),
    logos: section.querySelectorAll('img.tech-logo').length,
    broken,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  };
})()
```

**Resultado esperado en los cuatro viewports:**

```javascript
{
  missing: [],
  logos: 26,
  broken: [],
  horizontalOverflow: false
}
```

Inspección humana obligatoria:

- El nuevo grupo aparece entre infraestructura e IA.
- Los tres logos son reconocibles, están centrados y no quedan cortados dentro del recuadro claro de 23 × 23 px.
- Las etiquetas envuelven líneas de manera natural en 390 px y no producen scroll horizontal.
- No hay una fila huérfana visualmente extraña; si el logo ESP32 oficial es demasiado detallado a 17 px, reemplazarlo por el logo oficial de Espressif, manteniendo el texto visible `ESP32`, en lugar de agrandar todos los componentes.
- En vista de impresión, los tres logos se ven dentro de los recuadros de 16 × 16 px y el grupo no queda separado de sus etiquetas por un salto de página. Usar “Guardar como PDF” o emulación `print`; no cambiar globalmente la escala del documento para resolver un logo.

Detener el servidor con `Ctrl+C` tras validar.

### Task 6 — Revisar seguridad, hacer un commit local y detenerse

Revisar exactamente lo que se incorporará:

```bash
git diff --check
git status --short
git diff -- index.html tests/test_tech_catalog.py
git diff --numstat -- assets/tech/raspberry-pi.svg assets/tech/esp32.svg assets/tech/arduino.svg
```

Confirmar que los SVG no contienen scripts ni referencias externas:

```bash
python3 - <<'PY'
from pathlib import Path
import re
for path in map(Path, (
    'assets/tech/raspberry-pi.svg',
    'assets/tech/esp32.svg',
    'assets/tech/arduino.svg',
)):
    text = path.read_text(encoding='utf-8')
    assert not re.search(r'<script\b', text, re.I), path
    assert not re.search(r'(?:href|src)=["\']https?://', text, re.I), path
print('OK: SVGs contain no scripts or external runtime references')
PY
```

**Resultado esperado:** `OK: SVGs contain no scripts or external runtime references`.

Crear un único commit local después de que todo pase:

```bash
git add index.html \
  assets/tech/raspberry-pi.svg \
  assets/tech/esp32.svg \
  assets/tech/arduino.svg \
  tests/test_tech_catalog.py
git add .hermes/plans/2026-10-12_041922-agregar-hardware-iot.md
git commit -m "feat: agrega tecnologías de hardware e IoT"
```

**Resultado esperado:** commit creado con seis archivos funcionales más el plan si se versiona; `git status --short --branch` queda limpio y muestra `main` adelantada en 1 respecto de `origin/main`.

**Detenerse aquí. No ejecutar `git push`.** Entregar a José el hash del commit, las pruebas realizadas y una vista previa local o túnel solo si la solicita. El push a producción debe ejecutarse únicamente tras aprobación explícita.

## Tests / validation

Ciclo TDD de la funcionalidad:

1. **RED:** crear `tests/test_tech_catalog.py` y verificar que falla por grupo, etiquetas y archivos inexistentes.
2. **GREEN:** incorporar los tres SVG y el bloque HTML mínimo; ejecutar `python3 -m unittest tests/test_tech_catalog.py -v` hasta obtener `OK`.
3. **REFACTOR:** solamente normalizar un SVG si no se ve correctamente a 17 px; no crear componentes, JavaScript ni CSS adicional sin evidencia de que el patrón actual falla.
4. Ejecutar el validador global: exactamente **26** referencias únicas a logos tecnológicos, todos existentes y parseables.
5. Revisar `git diff --check`, ausencia de scripts/referencias remotas dentro de SVG y diff acotado.
6. Validar visualmente cuatro anchos, carga de imágenes, ausencia de overflow y versión de impresión.
7. Commit local único después de todas las verificaciones; sin push.

## Risks, tradeoffs, and open questions

- **Veracidad de la competencia:** el cambio comunica que José trabaja con estas tecnologías, no solo que le interesan. Si el nivel es exploratorio, conviene cambiar el nombre del grupo o añadir contexto antes de publicar.
- **Marca Arduino:** Arduino permite uso descriptivo del logo en contenido explicativo, pero mantiene reglas estrictas de marca. La etiqueta debe presentarse como tecnología usada, nunca como afiliación, certificación o producto oficial de José/MMJ Systems; no modificar el logo.
- **Raspberry Pi:** la fuente propuesta es Simple Icons, no un paquete oficial de branding con URL estable. Es adecuada como icono descriptivo, pero el implementador debe preservar sus proporciones y no reinterpretar la marca.
- **ESP32:** el recurso oficial `chip-esp32.svg` puede tener demasiado detalle a 17 px. La alternativa recomendada es el logo oficial de Espressif con texto visible `ESP32`; no inventar un isotipo.
- **Dependencia de URLs durante implementación:** los recursos quedarán locales, pero sus URLs de descarga pueden cambiar. Validar contenido y origen antes del commit; nunca introducir una dependencia CDN en el HTML.
- **Densidad visual:** el catálogo pasará de 23 a 26 logos. El nuevo grupo evita mezclar categorías, pero aumenta la altura de la sección. Esto es preferible a reducir tipografía o comprimir todas las etiquetas.
- **Pregunta abierta no bloqueante:** si José quiere destacar una oferta explícita de prototipado/IoT y no solo enumerar herramientas, eso sería una modificación de contenido comercial separada; no está incluida en este alcance.
