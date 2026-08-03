import json
import re
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

# ============================================================
# CONFIG
# ============================================================

INPUT_JSON = "lions_camps.json"
OUTPUT_JSON = "lions_camps_enriched.json"
BASE_URL = "https://www.lions-yce-belgium.be"
DESTINATIONS_BASE = f"{BASE_URL}/destinations"
REQUEST_TIMEOUT = 20
REQUEST_DELAY_SECONDS = 0.6
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0 Safari/537.36"
)

# Si True, on tente plusieurs variantes de slug si la première URL retourne 404.
ENABLE_SLUG_FALLBACKS = True


# ============================================================
# UTILS
# ============================================================

def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def slugify(text: str) -> str:
    """
    Convertit un nom de camp en slug :
    - minuscules
    - accents supprimés
    - & devient and
    - espaces -> tirets
    - caractères spéciaux retirés
    """
    # minuscules
    text = text.lower().strip()    
    
    # supprimer accents
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    
    # remplacer espaces par -
    text = re.sub(r"\s+", "-", text)

    # garder uniquement caractères autorisés
    text = re.sub(r'[^a-z0-9\-\(\),&:.!"]', '', text)
    # text = re.sub(r"[^a-z0-9]+", "-", text)
    # text = re.sub(r"[’'`]", "", text)
    # text = text.replace("&", " and ")    

    # nettoyer doublons de -
    #text = re.sub(r"-{2,}", "-", text)
    #text = re.sub(r"-{2,}", "-", text).strip("-")
    
    # enlever - début/fin
    text = text.strip("-")         
    
    return text


def slug_variants(camp_name: str) -> List[str]:
    """
    Génère quelques variantes utiles pour les cas tordus vus sur le site.
    """
    base = slugify(camp_name)
    variants = [base]

    raw = camp_name.strip()

    replacements = [
        raw.replace("&", ""),
        raw.replace("&", " "),
        raw.replace("&", " and "),
        raw.replace(",", ""),
        raw.replace("(", ""),
        raw.replace(")", ""),
        raw.replace(":", ""),
        raw.replace("'", ""),
        raw.replace('"', ""),
        raw.replace("  ", " "),
    ]

    for candidate in replacements:
        s = slugify(candidate)
        if s and s not in variants:
            variants.append(s)

    # Variante pour certains titres avec doubles espaces ou ponctuation atypique
    compressed = re.sub(r"\s+", " ", raw)
    s = slugify(compressed)
    if s and s not in variants:
        variants.append(s)

    return variants


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )
    return session


def request_url(session: requests.Session, url: str) -> Optional[requests.Response]:
    try:
        response = session.get(url, timeout=REQUEST_TIMEOUT)
        if response.status_code == 200:
            return response
        return None
    except requests.RequestException:
        return None


# ============================================================
# EXTRACTION HTML
# ============================================================

def extract_visible_text_lines(soup: BeautifulSoup) -> List[str]:
    """
    Récupère les lignes visibles d'une page, nettoyées, pour parsing heuristique.
    """
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    text = soup.get_text("\n", strip=True)
    lines = [clean_text(line) for line in text.splitlines()]
    return [line for line in lines if line]


def find_value_after_label(lines: List[str], label: str, max_lookahead: int = 5) -> Optional[str]:
    """
    Cherche une valeur dans les lignes suivant un label exact ou quasi exact.
    """
    normalized_label = clean_text(label).lower()

    for i, line in enumerate(lines):
        current = clean_text(line).lower()

        if current == normalized_label:
            for j in range(i + 1, min(i + 1 + max_lookahead, len(lines))):
                candidate = clean_text(lines[j])
                if not candidate:
                    continue
                if candidate.lower() == normalized_label:
                    continue
                if candidate.lower() in {
                    "apply",
                    "camp list",
                    "more information",
                    "registrations are open! apply now!",
                }:
                    continue
                return candidate

        # tolérance légère
        if normalized_label in current and len(current) <= len(normalized_label) + 5:
            for j in range(i + 1, min(i + 1 + max_lookahead, len(lines))):
                candidate = clean_text(lines[j])
                if candidate:
                    return candidate

    return None


def find_pair_after_label(lines: List[str], label: str, max_lookahead: int = 8) -> List[str]:
    """
    Cherche 2 valeurs successives après un label, utile pour les dates from/to.
    """
    normalized_label = clean_text(label).lower()

    for i, line in enumerate(lines):
        current = clean_text(line).lower()
        if current == normalized_label or (normalized_label in current and len(current) <= len(normalized_label) + 5):
            values: List[str] = []
            for j in range(i + 1, min(i + 1 + max_lookahead, len(lines))):
                candidate = clean_text(lines[j])
                if not candidate:
                    continue
                if candidate.lower() in {
                    "apply",
                    "camp list",
                    "more information",
                }:
                    continue
                values.append(candidate)
                if len(values) == 2:
                    return values
    return []


def extract_long_description(lines: List[str]) -> Optional[str]:
    """
    Tente de récupérer le texte descriptif principal.
    Souvent juste après 'Camp Activities'.
    """
    for i, line in enumerate(lines):
        if clean_text(line).lower() == "camp activities":
            collected: List[str] = []
            for j in range(i + 1, min(i + 20, len(lines))):
                candidate = clean_text(lines[j])
                if not candidate:
                    continue

                lower = candidate.lower()
                if lower in {
                    "host family activities",
                    "age requirements",
                    "languages spoken",
                    "host family 1 from / to",
                    "camp from / to",
                    "host family 2 from / to",
                    "fee",
                    "camp website",
                    "apply",
                    "camp list",
                    "more information",
                }:
                    break

                collected.append(candidate)

            if collected:
                return " ".join(collected)

    return None


def extract_title_from_page(lines: List[str]) -> Optional[str]:
    """
    Tente d'extraire le titre principal après 'Detailed Camp Information'.
    """
    for i, line in enumerate(lines):
        if clean_text(line).lower() == "detailed camp information":
            for j in range(i + 1, min(i + 8, len(lines))):
                candidate = clean_text(lines[j])
                if not candidate:
                    continue
                if candidate.lower() in {"registrations are open! apply now!", "apply"}:
                    continue
                return candidate
    return None


def extract_location_country_continent(lines: List[str]) -> Dict[str, Optional[str]]:
    """
    Après le titre, les pages affichent souvent location / country / continent.
    """
    result = {
        "location": None,
        "page_country": None,
        "page_continent": None,
    }

    for i, line in enumerate(lines):
        if clean_text(line).lower() == "detailed camp information":
            block = lines[i + 1 : i + 12]
            cleaned = [clean_text(x) for x in block if clean_text(x)]
            if len(cleaned) >= 4:
                # pattern fréquent :
                # [Title, Location, Country, Continent]
                result["location"] = cleaned[1] if len(cleaned) > 1 else None
                result["page_country"] = cleaned[2] if len(cleaned) > 2 else None
                result["page_continent"] = cleaned[3] if len(cleaned) > 3 else None
            break

    return result


def extract_camp_website(lines: List[str], html: str) -> Optional[str]:
    """
    Cherche un site web de camp externe.
    """
    value = find_value_after_label(lines, "Camp website")
    if value and value.lower().startswith("http"):
        return value

    # fallback regex dans le HTML
    urls = re.findall(r'https?://[^\s"<>()]+', html)
    urls = [u for u in urls if "lions-yce-belgium.be" not in u]
    return urls[0] if urls else None


def parse_camp_detail(html: str, source_url: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    lines = extract_visible_text_lines(soup)

    title = extract_title_from_page(lines)
    geo = extract_location_country_continent(lines)
    camp_activities = extract_long_description(lines)
    host_family_activities = find_value_after_label(lines, "Host family Activities")
    age_requirements = find_value_after_label(lines, "Age requirements")
    languages_spoken = find_value_after_label(lines, "Languages spoken")
    fee = find_value_after_label(lines, "Fee")

    host_family_1 = find_pair_after_label(lines, "Host family 1 from / to")
    camp_from_to = find_pair_after_label(lines, "Camp from / to")
    host_family_2 = find_pair_after_label(lines, "Host family 2 from / to")
    camp_website = extract_camp_website(lines, html)

    languages_list = []
    if languages_spoken:
        languages_list = [clean_text(x) for x in re.split(r",|/|;|\|", languages_spoken) if clean_text(x)]

    return {
        "url": source_url,
        "title_from_page": title,
        "location": geo.get("location"),
        "page_country": geo.get("page_country"),
        "page_continent": geo.get("page_continent"),
        "description": camp_activities,
        "camp_activities": camp_activities,
        "host_family_activities": host_family_activities,
        "age_requirements_page": age_requirements,
        "languages_spoken": languages_list,
        "host_family_1": {
            "from": host_family_1[0] if len(host_family_1) > 0 else None,
            "to": host_family_1[1] if len(host_family_1) > 1 else None,
        },
        "camp_period_page": {
            "from": camp_from_to[0] if len(camp_from_to) > 0 else None,
            "to": camp_from_to[1] if len(camp_from_to) > 1 else None,
        },
        "host_family_2": {
            "from": host_family_2[0] if len(host_family_2) > 0 else None,
            "to": host_family_2[1] if len(host_family_2) > 1 else None,
        },
        "fee_page": fee,
        "camp_website": camp_website,
        "scraped": True,
    }


# ============================================================
# LOOKUP PAGE
# ============================================================

def resolve_camp_page(session: requests.Session, camp_name: str) -> Dict[str, Any]:
    variants = slug_variants(camp_name) if ENABLE_SLUG_FALLBACKS else [slugify(camp_name)]

    for slug in variants:
        url = f"{DESTINATIONS_BASE}/{quote(slug)}"
        response = request_url(session, url)
        if response is not None and response.text:
            return {
                "slug": slug,
                "url": url,
                "html": response.text,
                "status": "ok",
            }

    return {
        "slug": variants[0] if variants else slugify(camp_name),
        "url": f"{DESTINATIONS_BASE}/{quote(variants[0])}" if variants else None,
        "html": None,
        "status": "not_found",
    }


# ============================================================
# ENRICHISSEMENT JSON
# ============================================================

def enrich_camp_record(session: requests.Session, record: Dict[str, Any]) -> Dict[str, Any]:

    # 🔥 SKIP si déjà scrapé
    if record.get("camp_detail", {}).get("scraped") is True:
        return record
    
    camp_name = record.get("camp_name", "").strip()
    if not camp_name:
        record["camp_detail"] = {
            "scraped": False,
            "error": "missing camp_name",
        }
        return record

    resolved = resolve_camp_page(session, camp_name)

    detail: Dict[str, Any] = {
        "slug": resolved.get("slug"),
        "url": resolved.get("url"),
        "scraped": False,
    }

    if resolved["status"] != "ok" or not resolved["html"]:
        detail["error"] = "page not found"
        record["camp_detail"] = detail
        return record

    parsed = parse_camp_detail(resolved["html"], resolved["url"])
    detail.update(parsed)

    # Petit contrôle de cohérence utile
    detail["matches_source_country"] = (
        True if not detail.get("page_country") else detail["page_country"].strip().lower() == str(record.get("country", "")).strip().lower()
    )
    detail["matches_source_continent"] = (
        True if not detail.get("page_continent") else detail["page_continent"].strip().lower() == str(record.get("continent", "")).strip().lower()
    )

    record["camp_detail"] = detail
    return record


def enrich_json_file(input_path: str, output_path: str) -> None:
    data = load_json(input_path)

    camps = data.get("lions_youth_camps", [])
    if not isinstance(camps, list):
        raise ValueError("Le JSON doit contenir une clé 'lions_youth_camps' avec une liste.")

    session = make_session()
    enriched: List[Dict[str, Any]] = []

    total = len(camps)
    for idx, camp in enumerate(camps, start=1):
        camp_name = camp.get("camp_name", "UNKNOWN")
        print(f"[{idx}/{total}] {camp_name}")

        try:
            enriched_record = enrich_camp_record(session, dict(camp))
            enriched.append(enriched_record)

            detail = enriched_record.get("camp_detail", {})
            status = "OK" if detail.get("scraped") else f"FAILED ({detail.get('error')})"
            print(f"    -> {status} | {detail.get('url')}")

        except Exception as e:
            failed_record = dict(camp)
            failed_record["camp_detail"] = {
                "scraped": False,
                "error": str(e),
            }
            enriched.append(failed_record)
            print(f"    -> ERROR: {e}")

        time.sleep(REQUEST_DELAY_SECONDS)

    output_data = dict(data)
    output_data["lions_youth_camps"] = enriched
    save_json(output_data, output_path)

    ok_count = sum(1 for c in enriched if c.get("camp_detail", {}).get("scraped"))
    fail_count = len(enriched) - ok_count

    print("\n============================================================")
    print(f"Terminé. Fichier créé : {output_path}")
    print(f"Camps enrichis : {ok_count}")
    print(f"Camps non trouvés / erreurs : {fail_count}")
    print("============================================================")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    if not Path(INPUT_JSON).exists():
        raise FileNotFoundError(f"Fichier introuvable : {INPUT_JSON}")

    enrich_json_file(INPUT_JSON, OUTPUT_JSON)