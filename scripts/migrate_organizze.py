#!/usr/bin/env python3
"""
Script de migração do Organizze para o myPay

Requisitos:
    pip install firebase-admin requests boto3 python-dotenv

Configuração:
    1. Baixe o arquivo de service account do Firebase:
       - Vá em https://console.firebase.google.com
       - Selecione seu projeto
       - Configurações do projeto > Contas de serviço
       - Gerar nova chave privada
       - Salve como 'firebase-credentials.json' na pasta scripts/

    2. Adicione no .env da raiz do projeto:
       FIREBASE_USER_ID=seu_user_id_do_firebase
       (as outras credenciais já estão lá)

Uso:
    python migrate_organizze.py --start-date 2026-01-01 --end-date 2026-01-30
    python migrate_organizze.py --start-date
      --dry-run
"""

import argparse
import json
import os
import sys
from base64 import b64encode
from datetime import datetime
from pathlib import Path

import requests

# Carregar variáveis de ambiente do .env da raiz do projeto
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent
load_dotenv(project_root / ".env")

import boto3
import firebase_admin
from firebase_admin import credentials, firestore

# Configurações (usa as variáveis VITE_* do .env existente)
ORGANIZZE_BASE_URL = "https://api.organizze.com.br/rest/v2"
ORGANIZZE_EMAIL = os.getenv("VITE_ORGANIZZE_EMAIL")
ORGANIZZE_API_KEY = os.getenv("VITE_ORGANIZZE_API_KEY")
FIREBASE_USER_ID = os.getenv("FIREBASE_USER_ID")
S3_ENDPOINT_URL = os.getenv("VITE_S3_ENDPOINT_URL")
S3_ACCESS_KEY_ID = os.getenv("VITE_S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = os.getenv("VITE_S3_SECRET_ACCESS_KEY")
S3_BUCKET_NAME = os.getenv("VITE_S3_BUCKET_NAME")
S3_REGION = os.getenv("VITE_S3_REGION", "auto")
S3_PUBLIC_URL = os.getenv("VITE_S3_PUBLIC_URL")
S3_PATH_PREFIX = os.getenv("VITE_S3_PATH_PREFIX", "")

# Inicializar Firebase
firebase_creds = os.getenv("FIREBASE_CREDENTIALS")

if firebase_creds:
    # Verificar se é um caminho de arquivo ou JSON direto
    if firebase_creds.startswith("/") or firebase_creds.startswith("."):
        # É um caminho de arquivo
        cred_path = Path(firebase_creds)
        if not cred_path.exists():
            print(f"❌ Arquivo de credenciais não encontrado: {cred_path}")
            sys.exit(1)
        cred = credentials.Certificate(str(cred_path))
    else:
        # É JSON direto
        try:
            cred_dict = json.loads(firebase_creds)
            cred = credentials.Certificate(cred_dict)
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao parsear FIREBASE_CREDENTIALS: {e}")
            sys.exit(1)
else:
    print("❌ FIREBASE_CREDENTIALS não configurado no .env")
    print("   Use o caminho do arquivo JSON ou o conteúdo JSON direto")
    sys.exit(1)

firebase_admin.initialize_app(cred)
db = firestore.client()

# Inicializar S3/R2
s3_client = None
if S3_ENDPOINT_URL and S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        region_name=S3_REGION,
    )


def organizze_request(endpoint: str) -> dict:
    """Faz requisição à API do Organizze"""
    auth_string = b64encode(f"{ORGANIZZE_EMAIL}:{ORGANIZZE_API_KEY}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_string}",
        "Content-Type": "application/json",
        "User-Agent": f"myPay Migration ({ORGANIZZE_EMAIL})",
    }

    response = requests.get(f"{ORGANIZZE_BASE_URL}{endpoint}", headers=headers)
    response.raise_for_status()
    return response.json()


def get_content_type_from_filename(filename: str) -> str:
    """Detecta content-type pela extensão do arquivo"""
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    mime_types = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "txt": "text/plain",
    }
    return mime_types.get(ext, "application/octet-stream")


def download_attachment(url: str, email: str, api_key: str) -> tuple[bytes, str, str]:
    """Baixa um attachment do Organizze"""
    import re
    from urllib.parse import unquote, urlparse

    # Extrair nome do arquivo da URL como fallback
    parsed_url = urlparse(url)
    url_filename = (
        unquote(parsed_url.path.split("/")[-1]) if parsed_url.path else "attachment"
    )

    # Se for URL do S3 (amazonaws.com), tentar sem autenticação primeiro
    is_s3_url = "s3.amazonaws.com" in url or "amazonaws.com" in url

    if is_s3_url:
        # S3 URLs não aceitam Basic Auth - tentar sem auth
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            # Se falhar, pode ser URL que precisa de redirect ou está expirada
            print(
                f"      ⚠️  URL do S3 não acessível (pode estar expirada): {url_filename}"
            )
            raise
    else:
        # URLs da API do Organizze usam Basic Auth
        auth_string = b64encode(f"{email}:{api_key}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_string}",
            "User-Agent": f"myPay Migration ({email})",
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")

    # Tentar extrair nome do arquivo do header
    content_disposition = response.headers.get("content-disposition", "")
    filename = url_filename  # Usar nome da URL como default
    if "filename=" in content_disposition:
        match = re.search(
            r'filename[^;=\n]*=([\'"]?)([^\'";\n]*)\1', content_disposition
        )
        if match:
            filename = match.group(2)

    # Se não veio content-type válido, detectar pela extensão
    if not content_type or content_type in ("application/octet-stream", "binary/octet-stream"):
        content_type = get_content_type_from_filename(filename)

    return response.content, content_type, filename


def upload_to_s3(data: bytes, content_type: str, filename: str, user_id: str) -> str:
    """Faz upload para Cloudflare R2"""
    if not s3_client or not S3_PUBLIC_URL:
        return None

    timestamp = int(datetime.now().timestamp() * 1000)
    safe_filename = "".join(c if c.isalnum() or c in ".-" else "_" for c in filename)
    base_path = f"{S3_PATH_PREFIX}/comprovantes" if S3_PATH_PREFIX else "comprovantes"
    key = f"{base_path}/{user_id}/{timestamp}_{safe_filename}"

    s3_client.put_object(
        Bucket=S3_BUCKET_NAME, Key=key, Body=data, ContentType=content_type
    )

    return f"{S3_PUBLIC_URL}/{key}"


def parse_date(date_str: str) -> datetime:
    """Converte string de data para datetime com horário meio-dia (evita problemas de timezone)"""
    if not date_str:
        return datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)

    # Organizze retorna datas no formato YYYY-MM-DD
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(hour=12, minute=0, second=0, microsecond=0)
    except ValueError:
        return datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)


def map_account_type(org_type: str) -> str:
    """Mapeia tipo de conta do Organizze para myPay"""
    mapping = {"checking": "checking", "savings": "savings", "other": "wallet"}
    return mapping.get(org_type, "wallet")


def map_card_brand(network: str) -> str:
    """Mapeia bandeira do cartão"""
    mapping = {
        "visa": "Visa",
        "mastercard": "Mastercard",
        "amex": "American Express",
        "elo": "Elo",
        "hipercard": "Hipercard",
        "diners": "Diners",
    }
    return mapping.get(network.lower() if network else "", network or "Outro")


def get_card_color(network: str) -> str:
    """Retorna cor do cartão baseado na bandeira"""
    colors = {
        "visa": "blue",
        "mastercard": "red",
        "amex": "slate",
        "elo": "orange",
        "hipercard": "red",
        "nubank": "purple",
    }
    return colors.get(network.lower() if network else "", "slate")


def migrate(start_date: str, end_date: str, dry_run: bool = False):
    """Executa a migração"""
    if not ORGANIZZE_EMAIL or not ORGANIZZE_API_KEY:
        print("❌ Configure ORGANIZZE_EMAIL e ORGANIZZE_API_KEY no arquivo .env")
        sys.exit(1)

    if not FIREBASE_USER_ID:
        print("❌ Configure FIREBASE_USER_ID no arquivo .env")
        sys.exit(1)

    user_ref = db.collection("users").document(FIREBASE_USER_ID)

    print("🔄 Buscando dados do Organizze...")

    # 1. Buscar contas
    print("   📁 Buscando contas...")
    accounts = organizze_request("/accounts")
    print(f"      Encontradas: {len(accounts)}")

    # 2. Buscar categorias
    print("   📁 Buscando categorias...")
    categories = organizze_request("/categories")
    category_map = {cat["id"]: cat for cat in categories}
    print(f"      Encontradas: {len(categories)}")

    # 3. Buscar cartões
    print("   📁 Buscando cartões...")
    credit_cards = organizze_request("/credit_cards")
    print(f"      Encontrados: {len(credit_cards)}")

    # 4. Buscar transações
    print(f"   📁 Buscando transações ({start_date} a {end_date})...")
    transactions = organizze_request(
        f"/transactions?start_date={start_date}&end_date={end_date}"
    )
    print(f"      Encontradas: {len(transactions)}")

    # Mostrar datas das transações retornadas
    if transactions:
        dates = sorted(set(t.get("date", "sem data") for t in transactions))
        print("      Datas retornadas pelo Organizze:")
        for d in dates[:10]:
            print(f"         {d}")
        if len(dates) > 10:
            print(f"         ... e mais {len(dates) - 10} datas")

    # Estatísticas
    normal_transactions = [t for t in transactions if not t.get("credit_card_id")]
    card_transactions = [t for t in transactions if t.get("credit_card_id")]
    attachments_count = sum(len(t.get("attachments", [])) for t in transactions)

    print("\n📊 Resumo:")
    print(f"   Contas: {len([a for a in accounts if not a.get('archived')])}")
    print(f"   Cartões: {len([c for c in credit_cards if not c.get('archived')])}")
    print(f"   Transações normais: {len(normal_transactions)}")
    print(f"   Transações de cartão: {len(card_transactions)}")
    print(f"   Anexos: {attachments_count}")

    if dry_run:
        print("\n⚠️  Modo dry-run: nenhum dado foi importado")
        return

    print("\n🚀 Iniciando importação...")

    # Importar contas
    print("   💰 Importando contas...")
    imported_accounts = 0
    for acc in accounts:
        if acc.get("archived"):
            continue

        doc_data = {
            "name": acc["name"],
            "type": map_account_type(acc.get("type", "checking")),
            "balance": 0,
            "isActive": True,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "_organizzeId": acc["id"],
        }
        user_ref.collection("accounts").add(doc_data)
        imported_accounts += 1
    print(f"      Importadas: {imported_accounts}")

    # Importar cartões
    print("   💳 Importando cartões...")
    imported_cards = 0
    for card in credit_cards:
        if card.get("archived"):
            continue

        doc_data = {
            "name": card["name"],
            "brand": map_card_brand(card.get("card_network")),
            "limit": (card.get("limit_cents", 0) or 0) / 100,
            "closingDay": card.get("closing_day", 1),
            "dueDay": card.get("due_day", 10),
            "color": get_card_color(card.get("card_network")),
            "isActive": True,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "_organizzeId": card["id"],
        }
        user_ref.collection("cards").add(doc_data)
        imported_cards += 1
    print(f"      Importados: {imported_cards}")

    # Importar transações normais
    print("   📝 Importando transações...")
    imported_transactions = 0
    imported_attachments = 0

    for t in normal_transactions:
        category = category_map.get(t.get("category_id"), {})
        category_name = category.get("name", "outros")
        category_id = category_name.lower().replace(" ", "_")

        # Processar tags
        tags = []
        if t.get("tags"):
            for tag in t["tags"]:
                if isinstance(tag, dict):
                    tags.append(tag.get("name", ""))
                else:
                    tags.append(str(tag))
            tags = [tag for tag in tags if tag]

        # Processar attachments
        attachments = []
        for att in t.get("attachments", []):
            att_url = att.get("url") or att.get("file_url") or att.get("document_url")
            if not att_url:
                continue

            try:
                data, content_type, filename = download_attachment(
                    att_url, ORGANIZZE_EMAIL, ORGANIZZE_API_KEY
                )

                # Limite de 10MB
                if len(data) > 10 * 1024 * 1024:
                    print(f"      ⚠️  Anexo muito grande, pulando: {filename}")
                    continue

                s3_url = upload_to_s3(data, content_type, filename, FIREBASE_USER_ID)
                if s3_url:
                    attachments.append(
                        {
                            "url": s3_url,
                            "fileName": filename,
                            "size": len(data),
                            "type": content_type,
                        }
                    )
                    imported_attachments += 1
            except Exception as e:
                print(f"      ⚠️  Erro ao processar anexo: {e}")

        is_income = (t.get("amount_cents", 0) or 0) > 0

        doc_data = {
            "description": t.get("description", "Sem descrição"),
            "amount": abs(t.get("amount_cents", 0) or 0) / 100,
            "type": "income" if is_income else "expense",
            "category": category_id,
            "date": parse_date(t.get("date")),
            "isPending": not t.get("paid", True),
            "notes": t.get("notes", ""),
            "tags": tags,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "_organizzeId": t["id"],
        }

        if attachments:
            doc_data["attachments"] = attachments

        user_ref.collection("transactions").add(doc_data)
        imported_transactions += 1

        if imported_transactions % 50 == 0:
            print(
                f"      Progresso: {imported_transactions}/{len(normal_transactions)}"
            )

    print(f"      Importadas: {imported_transactions}")
    print(f"      Anexos: {imported_attachments}")

    # Importar transações de cartão (como transações normais com nota indicando o cartão)
    print("   💳 Importando transações de cartão...")
    imported_card_transactions = 0

    card_map = {c["id"]: c["name"] for c in credit_cards}

    for t in card_transactions:
        category = category_map.get(t.get("category_id"), {})
        category_name = category.get("name", "outros")
        category_id = category_name.lower().replace(" ", "_")

        card_name = card_map.get(t.get("credit_card_id"), "Cartão")

        # Processar tags
        tags = []
        if t.get("tags"):
            for tag in t["tags"]:
                if isinstance(tag, dict):
                    tags.append(tag.get("name", ""))
                else:
                    tags.append(str(tag))
            tags = [tag for tag in tags if tag]

        # Processar attachments
        attachments = []
        for att in t.get("attachments", []):
            att_url = att.get("url") or att.get("file_url") or att.get("document_url")
            if not att_url:
                continue

            try:
                data, content_type, filename = download_attachment(
                    att_url, ORGANIZZE_EMAIL, ORGANIZZE_API_KEY
                )

                if len(data) > 10 * 1024 * 1024:
                    continue

                s3_url = upload_to_s3(data, content_type, filename, FIREBASE_USER_ID)
                if s3_url:
                    attachments.append(
                        {
                            "url": s3_url,
                            "fileName": filename,
                            "size": len(data),
                            "type": content_type,
                        }
                    )
                    imported_attachments += 1
            except Exception as e:
                print(f"      ⚠️  Erro ao processar anexo: {e}")

        doc_data = {
            "description": t.get("description", "Sem descrição"),
            "amount": abs(t.get("amount_cents", 0) or 0) / 100,
            "type": "expense",
            "category": category_id,
            "date": parse_date(t.get("date")),
            "isPending": False,
            "notes": f"Cartão: {card_name}",
            "tags": tags,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "_organizzeId": t["id"],
        }

        if attachments:
            doc_data["attachments"] = attachments

        user_ref.collection("transactions").add(doc_data)
        imported_card_transactions += 1

        if imported_card_transactions % 50 == 0:
            print(
                f"      Progresso: {imported_card_transactions}/{len(card_transactions)}"
            )

    print(f"      Importadas: {imported_card_transactions}")

    # Resumo final
    total = (
        imported_accounts
        + imported_cards
        + imported_transactions
        + imported_card_transactions
    )
    print("\n✅ Migração concluída!")
    print(f"   Total importado: {total} itens")
    print(f"   - Contas: {imported_accounts}")
    print(f"   - Cartões: {imported_cards}")
    print(f"   - Transações: {imported_transactions}")
    print(f"   - Transações de cartão: {imported_card_transactions}")
    print(f"   - Anexos: {imported_attachments}")


def main():
    parser = argparse.ArgumentParser(description="Migrar dados do Organizze para myPay")
    parser.add_argument("--start-date", required=True, help="Data inicial (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="Data final (YYYY-MM-DD)")
    parser.add_argument(
        "--dry-run", action="store_true", help="Apenas mostrar o que seria importado"
    )

    args = parser.parse_args()

    # Validar datas
    try:
        datetime.strptime(args.start_date, "%Y-%m-%d")
        datetime.strptime(args.end_date, "%Y-%m-%d")
    except ValueError:
        print("❌ Formato de data inválido. Use YYYY-MM-DD")
        sys.exit(1)

    migrate(args.start_date, args.end_date, args.dry_run)


if __name__ == "__main__":
    main()
