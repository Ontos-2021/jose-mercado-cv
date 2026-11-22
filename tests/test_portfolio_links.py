import json
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://josemercado.cl"
PAGES = {
    "index.html": "/",
    "automatizacion/index.html": "/automatizacion/",
    "proyectos/transcribeme.html": "/proyectos/transcribeme.html",
    "proyectos/servidor-hermes.html": "/proyectos/servidor-hermes.html",
    "cv/index.html": "/cv/",
}


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = []
        self.urls = []
        self.primary_links = []
        self.downloads = []
        self.forms = []
        self.fields = []
        self.headings = 0
        self.canonicals = []
        self.metadata = {}
        self.title = ""
        self.structured_data = []
        self._in_title = False
        self._json = None
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.headings += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            if key:
                self.metadata[key] = attrs.get("content")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self._json = []
        if tag == "a":
            if "download" in attrs:
                self.downloads.append(attrs["href"])
            if "button-solid" in attrs.get("class", "").split():
                self.primary_links.append(attrs["href"])
        if tag == "form":
            self.forms.append(attrs)
        if tag in ("input", "textarea"):
            self.fields.append(attrs)
        for attr in ("href", "src", "data-src"):
            if attrs.get(attr):
                self.urls.append(attrs[attr])

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._json is not None:
            self._json.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._json is not None:
            self.structured_data.append(json.loads("".join(self._json)))
            self._json = None


class PortfolioTests(unittest.TestCase):
    def test_local_links_and_media_exist(self):
        for relative in PAGES:
            page = ROOT / relative
            for url in Document(page).urls:
                parts = urlsplit(url)
                if parts.scheme or parts.netloc:
                    continue
                with self.subTest(page=relative, url=url):
                    path = page
                    if parts.path:
                        path = page.parent / unquote(parts.path)
                        if path.is_dir():
                            path /= "index.html"
                    self.assertTrue(path.is_file(), f"Missing {path}")
                    if parts.fragment and path.suffix == ".html":
                        self.assertIn(unquote(parts.fragment), Document(path).ids)

    def test_pages_have_unique_ids_and_one_main_heading(self):
        for relative in PAGES:
            doc = Document(ROOT / relative)
            with self.subTest(page=relative):
                self.assertEqual(doc.headings, 1)
                self.assertEqual(len(doc.ids), len(set(doc.ids)))

    def test_cv_download_is_pdf(self):
        for relative in PAGES:
            page = ROOT / relative
            [download] = Document(page).downloads
            with self.subTest(page=relative):
                with (page.parent / download).open("rb") as file:
                    self.assertEqual(file.read(5), b"%PDF-")

    def test_sitemap_matches_the_public_html_pages(self):
        sitemap = ET.parse(ROOT / "sitemap.xml")
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [element.text for element in sitemap.findall("s:url/s:loc", ns)]
        self.assertCountEqual(urls, [ORIGIN + route for route in PAGES.values()])
        self.assertIn(f"Sitemap: {ORIGIN}/sitemap.xml", (ROOT / "robots.txt").read_text().splitlines())

    def test_contact_uses_personal_api_and_keeps_direct_channels(self):
        doc = Document(ROOT / "index.html")
        [form] = doc.forms
        self.assertEqual(form["action"], "https://api.josemercado.cl/contacto")
        self.assertEqual(form["method"], "post")
        self.assertIn("hidden", form)
        self.assertIn("assets/contact.js", doc.urls)
        self.assertIn("mailto:josemercado.musica@gmail.com", doc.urls)
        self.assertIn("https://wa.me/56995391961", doc.urls)
        for key in ("aria-labelledby", "aria-describedby"):
            self.assertIn(form[key], doc.ids)
        self.assertCountEqual(
            (field["name"] for field in doc.fields if "required" in field),
            ["nombre", "email", "mensaje"],
        )
        [message] = [field for field in doc.fields if field.get("name") == "mensaje"]
        self.assertIn(message["aria-describedby"], doc.ids)

    def test_automation_is_the_primary_path_from_home_to_contact(self):
        home = Document(ROOT / "index.html")
        service = Document(ROOT / "automatizacion/index.html")
        self.assertEqual(home.primary_links, ["automatizacion/"])
        self.assertIn("#proyectos", home.urls)
        self.assertTrue(service.primary_links)
        self.assertEqual(set(service.primary_links), {"../#contacto"})
        self.assertIn("ejemplos", service.ids)

    def test_canonical_and_share_metadata_are_consistent(self):
        titles, descriptions = set(), set()
        for relative, route in PAGES.items():
            doc = Document(ROOT / relative)
            canonical = ORIGIN + route
            with self.subTest(page=relative):
                self.assertEqual(doc.canonicals, [canonical])
                self.assertEqual(doc.metadata["og:url"], canonical)
                self.assertEqual(doc.metadata["og:title"], doc.title)
                self.assertNotIn("noindex", doc.metadata.get("robots", ""))
                self.assertTrue(doc.title)
                self.assertNotIn(doc.title, titles)
                titles.add(doc.title)
                description = doc.metadata["description"]
                self.assertTrue(description)
                self.assertNotIn(description, descriptions)
                descriptions.add(description)
                image = doc.metadata["og:image"]
                self.assertTrue(image.startswith(ORIGIN + "/assets/social/"))
                self.assertTrue((ROOT / urlsplit(image).path.lstrip("/")).is_file())

    def test_structured_data_connects_person_and_pages(self):
        [profile] = Document(ROOT / "index.html").structured_data
        entities = {item["@type"]: item for item in profile["@graph"]}
        person = entities["Person"]
        self.assertEqual(person["name"], "José Mercado")
        self.assertEqual(entities["ProfilePage"]["mainEntity"]["@id"], person["@id"])

        for relative in (
            "automatizacion/index.html",
            "proyectos/transcribeme.html",
            "proyectos/servidor-hermes.html",
        ):
            with self.subTest(page=relative):
                [data] = Document(ROOT / relative).structured_data
                graph = {entry["@type"]: entry for entry in data["@graph"]}
                expected = ORIGIN + PAGES[relative]
                self.assertEqual(graph["WebPage"]["url"], expected)
                self.assertEqual(graph["WebPage"]["isPartOf"]["@id"], entities["WebSite"]["@id"])
                self.assertEqual(graph["BreadcrumbList"]["itemListElement"][-1]["item"], expected)
                if "author" in graph["WebPage"]:
                    self.assertEqual(graph["WebPage"]["author"]["@id"], person["@id"])
                if "Service" in graph:
                    self.assertEqual(graph["Service"]["provider"]["@id"], person["@id"])


if __name__ == "__main__":
    unittest.main()
