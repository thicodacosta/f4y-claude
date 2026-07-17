"""
publish_instagram.py — Publicação automática no Instagram via Meta Graph API
Usado pela skill .claude/skills/instagram/SKILL.md
"""
import argparse, os, sys, time, requests
from pathlib import Path
from dotenv import load_dotenv

# Encontra o .env automaticamente (sobe até 3 níveis)
script_dir = Path(__file__).parent
for i in range(4):
    env_file = script_dir / (".." * i).rstrip("/") / ".env" if i > 0 else script_dir.parent / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        break

IG_ID      = os.getenv("INSTAGRAM_BUSINESS_ID")
PAGE_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN")
BASE_URL   = f"https://graph.facebook.com/{os.getenv('META_API_VERSION', 'v19.0')}"


def host_image(image_path: str) -> str:
    """Hospeda imagem em URL pública via catbox.moe"""
    with open(image_path, "rb") as f:
        resp = requests.post(
            "https://catbox.moe/user/api.php",
            data={"reqtype": "fileupload"},
            files={"fileToUpload": (Path(image_path).name, f, "image/png")},
            timeout=60,
        )
    url = resp.text.strip()
    if not url.startswith("https://"):
        raise RuntimeError(f"Falha no upload: {url}")
    print(f"  Hospedada: {url}")
    return url


def create_media_container(image_path: str) -> str:
    resp = requests.post(f"{BASE_URL}/{IG_ID}/media", data={
        "access_token": PAGE_TOKEN,
        "image_url": host_image(image_path),
        "is_carousel_item": "true",
    }, timeout=60)
    result = resp.json()
    if "id" not in result:
        raise RuntimeError(f"Erro container: {result}")
    print(f"  Container: {result['id']}")
    return result["id"]


def create_carousel(media_ids: list, caption: str) -> str:
    resp = requests.post(f"{BASE_URL}/{IG_ID}/media", data={
        "access_token": PAGE_TOKEN,
        "media_type": "CAROUSEL",
        "children": ",".join(media_ids),
        "caption": caption,
    }, timeout=30)
    result = resp.json()
    if "id" not in result:
        raise RuntimeError(f"Erro carrossel: {result}")
    print(f"  Carrossel: {result['id']}")
    return result["id"]


def wait_ready(container_id: str) -> bool:
    for i in range(12):
        resp = requests.get(f"{BASE_URL}/{container_id}",
            params={"fields": "status_code", "access_token": PAGE_TOKEN}, timeout=15)
        status = resp.json().get("status_code", "")
        if status == "FINISHED":
            return True
        if status == "ERROR":
            raise RuntimeError(f"Container com erro: {resp.json()}")
        print(f"  Processando... {i*5}s")
        time.sleep(5)
    return False


def publish(container_id: str) -> str:
    resp = requests.post(f"{BASE_URL}/{IG_ID}/media_publish", data={
        "access_token": PAGE_TOKEN,
        "creation_id": container_id,
    }, timeout=30)
    result = resp.json()
    if "id" not in result:
        raise RuntimeError(f"Erro publicar: {result}")
    return result["id"]


def run(images: list, caption: str, dry_run: bool = False):
    if not IG_ID or not PAGE_TOKEN:
        print("ERRO: Credenciais nao encontradas. Rode a skill instagram (setup) primeiro.")
        sys.exit(1)
    if len(images) < 2:
        print("ERRO: Minimo 2 imagens para carrossel.")
        sys.exit(1)
    if len(images) > 10:
        print("ERRO: Maximo 10 imagens.")
        sys.exit(1)

    print(f"\nPublicando {len(images)} slides no Instagram...")
    if dry_run:
        print("[DRY RUN] Tudo OK. Remova --dry-run para publicar.")
        return

    print("\nPasso 1/3 - Criando containers...")
    ids = [create_media_container(img) for img in images]

    print("\nPasso 2/3 - Montando carrossel...")
    carousel_id = create_carousel(ids, caption)

    print("\nPasso 3/3 - Publicando...")
    if not wait_ready(carousel_id):
        print("ERRO: Timeout no processamento.")
        sys.exit(1)

    post_id = publish(carousel_id)
    print(f"\nPublicado com sucesso!")
    print(f"Post ID: {post_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", nargs="+", required=True)
    parser.add_argument("--caption", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(args.images, args.caption, args.dry_run)
