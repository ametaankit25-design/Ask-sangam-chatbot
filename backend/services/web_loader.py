"""Respectful, bounded loader for public university website content."""

from __future__ import annotations

from collections import deque
import re
from time import sleep
from typing import Iterable
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree

import truststore

# Requests normally uses Certifi's bundle. On managed Windows networks, the
# browser may trust an organisation certificate that is installed only in the
# operating-system certificate store. Use that store for public web ingestion.
truststore.inject_into_ssl()

import requests
from bs4 import BeautifulSoup
from langchain_core.documents import Document


class PublicWebsiteLoader:
    """Crawl same-domain, public HTML pages while honouring robots.txt."""

    USER_AGENT = "AskSangamKnowledgeBase/1.0 (+https://sangamuniversity.ac.in/)"
    SITEMAP_PATHS = ("/sitemap_index.xml", "/sitemap.xml", "/wp-sitemap.xml")

    def __init__(self, start_url: str, max_pages: int = 40):
        parsed = urlparse(start_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("A complete http(s) URL is required.")
        self.start_url = self._canonicalize(start_url)
        self.host = parsed.netloc.lower()
        self.max_pages = max(1, min(max_pages, 75))
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.USER_AGENT})
        self.robots = RobotFileParser()
        self.robots.set_url(urljoin(self.start_url, "/robots.txt"))
        try:
            self.robots.read()
        except OSError:
            # If unavailable, crawl conservatively; page-level errors are still skipped.
            self.robots = None

    @staticmethod
    def _canonicalize(url: str) -> str:
        url, _ = urldefrag(url)
        return url.rstrip("/") or url

    def _allowed_url(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.netloc.lower() != self.host or parsed.scheme not in {"http", "https"}:
            return False
        if parsed.query or parsed.path.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".svg", ".zip")):
            return False
        return self.robots is None or self.robots.can_fetch(self.USER_AGENT, url)

    @staticmethod
    def _extract_text(soup: BeautifulSoup) -> tuple[str, str, str]:
        title = soup.title.get_text(" ", strip=True) if soup.title else "Untitled page"
        footer = soup.find("footer")
        footer_text = footer.get_text(" ", strip=True) if footer else ""
        for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "iframe"]):
            tag.decompose()
        main = soup.find("main") or soup.find("article") or soup.find(attrs={"role": "main"}) or soup.body
        text = main.get_text(" ", strip=True) if main else ""
        return title, " ".join(text.split()), " ".join(footer_text.split())

    @staticmethod
    def _contact_details(footer_text: str) -> str:
        """Isolate a concise official contact block when a footer contains one."""
        match = re.search(
            r"CONTACT\s+US\s*(.*?)(?=\s*BANK\s+DETAILS|\s*Copyright|$)",
            footer_text,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip() if match else ""

    def _links(self, soup: BeautifulSoup, page_url: str) -> Iterable[str]:
        for link in soup.find_all("a", href=True):
            candidate = self._canonicalize(urljoin(page_url, link["href"]))
            if self._allowed_url(candidate):
                yield candidate

    def _discover_sitemap_urls(self) -> list[str]:
        """Discover public same-domain HTML pages from common WordPress sitemaps."""
        queue = deque(urljoin(self.start_url, path) for path in self.SITEMAP_PATHS)
        visited_sitemaps: set[str] = set()
        urls: list[str] = []

        while queue and len(visited_sitemaps) < 20:
            sitemap_url = queue.popleft()
            if sitemap_url in visited_sitemaps:
                continue
            visited_sitemaps.add(sitemap_url)
            try:
                response = self.session.get(sitemap_url, timeout=15)
                response.raise_for_status()
                root = ElementTree.fromstring(response.content)
            except (requests.RequestException, ElementTree.ParseError):
                continue

            for loc in root.findall(".//{*}loc"):
                candidate = self._canonicalize(loc.text or "")
                if not candidate:
                    continue
                if root.tag.endswith("sitemapindex"):
                    if urlparse(candidate).netloc.lower() == self.host:
                        queue.append(candidate)
                elif self._allowed_url(candidate):
                    urls.append(candidate)

        # Preserve homepage first, deduplicate sitemap entries, and keep the
        # crawl bounded even when the site publishes thousands of URLs.
        return list(dict.fromkeys([self.start_url, *urls]))[: self.max_pages]

    def load(self) -> list[Document]:
        """Return documents from at most `max_pages` crawlable same-domain pages."""
        sitemap_urls = self._discover_sitemap_urls()
        queue = deque(sitemap_urls or [self.start_url])
        seen: set[str] = set()
        documents: list[Document] = []

        while queue and len(documents) < self.max_pages:
            page_url = queue.popleft()
            if page_url in seen or not self._allowed_url(page_url):
                continue
            seen.add(page_url)
            try:
                response = self.session.get(page_url, timeout=15)
                response.raise_for_status()
            except requests.RequestException:
                continue
            if "text/html" not in response.headers.get("content-type", "").lower():
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            title, text, footer_text = self._extract_text(soup)
            # The homepage footer contains canonical contact information. Keep
            # it while excluding repeated navigation/footer noise from every
            # other crawled page.
            if page_url == self.start_url and footer_text:
                contact_details = self._contact_details(footer_text)
                contact_section = (
                    "Official university contact address and phone numbers: "
                    f"{contact_details}\n\n"
                    if contact_details
                    else ""
                )
                text = f"{contact_section}{text}\n\nOfficial website footer information:\n{footer_text}"
            if len(text) >= 120:
                documents.append(Document(page_content=text, metadata={"source": page_url, "title": title}))
            for link in self._links(soup, page_url):
                if link not in seen:
                    queue.append(link)
            sleep(0.25)

        if not documents:
            raise ValueError("No readable public HTML pages were found for that URL.")
        return documents
