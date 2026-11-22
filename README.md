# José Mercado · Portafolio personal

Sitio estático de [josemercado.cl](https://josemercado.cl/): desarrollo de producto, automatización, sonido y bitácora.

## Vista local

No requiere dependencias ni compilación. Desde la raíz:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Abre [la portada](http://127.0.0.1:8765/) o [el CV](http://127.0.0.1:8765/cv/).

## Contenido

- `index.html`: portada, proyectos, experiencia, trayectoria, bitácora, formación y contacto.
- `proyectos/`: casos de Transcríbeme.cl y el servidor personal con Hermes.
- `automatizacion/index.html`: página para quienes buscan automatizar un proceso, con ejemplos del portafolio.
- `assets/monograma-jm.svg`: monograma JM de Señal verde, usado en la navegación y como icono de la pestaña.
- `assets/site.css`: estilos de la portada y los casos. El monitor, las rutas de cables, la retícula y las texturas comparten el lenguaje visual de una terminal conectada a una consola de sonido.
- `assets/fonts/brand.css`: tipografía local de Estudio técnico (Space Grotesk e Inter), compartida por el sitio y el CV. Sus licencias están en `assets/fonts/`.
- `assets/motion.js`: recorrido por Bebop, Transcríbeme y Hermes, video controlado por scroll, parallax, animaciones de entrada y galería lateral. Respeta la preferencia de movimiento reducido y ofrece un control en la portada.
- `assets/media/`: el clip «Una fecha más» y su edición para scroll (solo la toma continua), el fondo de jazz generado con Higgsfield, la textura de grano SVG, imágenes fijas y la captura del ejemplo público de Transcríbeme. La sala es ficticia; no se usó material de Bebop.
- `cv/index.html`: fuente editable del CV. Después de editarla, regenera `cv/jose-mercado.pdf` desde el navegador en A4 sin encabezado ni pie del navegador. El PDF enlaza a las URL públicas de los casos.
- `certificados/`: diplomas originales, sin cambios.
- `robots.txt` y `sitemap.xml`: rastreo y URL canónicas de las páginas HTML públicas.
- `assets/social/`: imágenes de 1200 × 630 para compartir la portada y los casos; no se descargan al abrir una página.

## Búsqueda orgánica

Al publicar, comprueba que `https://josemercado.cl/sitemap.xml` y las cinco páginas respondan `200` y que los títulos, los enlaces internos y el mapa apunten a las mismas URL definitivas. Envía el mapa en [Google Search Console](https://search.google.com/search-console) desde una propiedad verificada. Inspecciona la portada y `/automatizacion/` para confirmar cómo las ve Google y si la URL canónica coincide. Luego compara impresiones y clics de consultas con tu nombre y sin él; enviar el mapa no garantiza indexación ni posiciones.

## Pruebas

```bash
python3 -B -m unittest discover -s tests
```
