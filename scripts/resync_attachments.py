#!/usr/bin/env python3
"""
Script para re-sincronizar anexos do Organizze para R2

Este script:
1. Busca transações no Firestore
2. Busca correspondentes no Organizze (por descrição/data/valor)
3. Baixa anexos do Organizze e faz upload para R2
4. Atualiza o Firestore com as novas URLs

Requisitos:
    pip install firebase-admin requests boto3 python-dotenv

Uso:
    python resync_attachments.py
    python resync_attachments.py --dry-run
    python resync_attachments.py --add-new  # também adiciona anexos que faltam
"""

import argparse
import json
import os
import sys
import time
from base64 import b64encode
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent
load_dotenv(project_root / ".env")

import boto3
import firebase_admin
from firebase_admin import credentials, firestore

# Configurações
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
    if firebase_creds.startswith("/") or firebase_creds.startswith("."):
        cred_path = Path(firebase_creds)
        if not cred_path.exists():
            print(f"❌ Arquivo de credenciais não encontrado: {cred_path}")
            sys.exit(1)
        cred = credentials.Certificate(str(cred_path))
    else:
        try:
            cred_dict = json.loads(firebase_creds)
            cred = credentials.Certificate(cred_dict)
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao parsear FIREBASE_CREDENTIALS: {e}")
            sys.exit(1)
else:
    print("❌ FIREBASE_CREDENTIALS não configurado no .env")
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
        "User-Agent": f"myPay Resync ({ORGANIZZE_EMAIL})",
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


def download_attachment(url: str) -> tuple[bytes, str, str] | None:
    """Baixa um attachment do Organizze"""
    from urllib.parse import unquote, urlparse

    parsed_url = urlparse(url)
    url_filename = (
        unquote(parsed_url.path.split("/")[-1]) if parsed_url.path else "attachment"
    )

    is_s3_url = "s3.amazonaws.com" in url or "amazonaws.com" in url

    try:
        if is_s3_url:
            response = requests.get(url, timeout=30)
        else:
            auth_string = b64encode(
                f"{ORGANIZZE_EMAIL}:{ORGANIZZE_API_KEY}".encode()
            ).decode()
            headers = {
                "Authorization": f"Basic {auth_string}",
                "User-Agent": f"myPay Resync ({ORGANIZZE_EMAIL})",
            }
            response = requests.get(url, headers=headers, timeout=30)

        response.raise_for_status()
        content_type = response.headers.get("content-type", "")

        # Se não veio content-type válido, detectar pela extensão
        if not content_type or content_type == "application/octet-stream" or content_type == "binary/octet-stream":
            content_type = get_content_type_from_filename(url_filename)

        return response.content, content_type, url_filename
    except Exception as e:
        print(f"      ⚠️  Erro ao baixar: {e}")
        return None


def upload_to_r2(data: bytes, content_type: str, filename: str, user_id: str) -> dict:
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

    return {
        "url": f"{S3_PUBLIC_URL}/{key}",
        "key": key,
        "fileName": filename,
        "size": len(data),
        "type": content_type,
    }


def normalize_string(s: str) -> str:
    """Normaliza string para comparação"""
    return (s or "").lower().strip().replace("  ", " ")


def find_organizze_match(fs_tx: dict, org_txs: list) -> dict | None:
    """Encontra transação correspondente no Organizze"""
    fs_desc = normalize_string(fs_tx.get("description", ""))
    fs_date = fs_tx.get("date")
    if hasattr(fs_date, "strftime"):
        fs_date = fs_date.strftime("%Y-%m-%d")
    fs_amount = abs(fs_tx.get("amount", 0))

    # Match exato
    for org_tx in org_txs:
        org_desc = normalize_string(org_tx.get("description", ""))
        org_date = org_tx.get("date")
        org_amount = abs(org_tx.get("amount_cents", 0)) / 100

        if (
            org_desc == fs_desc
            and org_date == fs_date
            and abs(org_amount - fs_amount) < 0.02
        ):
            return org_tx

    # Match parcial
    for org_tx in org_txs:
        org_desc = normalize_string(org_tx.get("description", ""))
        org_date = org_tx.get("date")
        org_amount = abs(org_tx.get("amount_cents", 0)) / 100

        if (
            (org_desc in fs_desc or fs_desc in org_desc)
            and org_date == fs_date
            and abs(org_amount - fs_amount) < 0.02
        ):
            return org_tx

    return None


def is_broken_url(url: str, force_all: bool = False) -> bool:
    """Verifica se URL é do MinIO antigo ou está quebrada"""
    if not url:
        return False
    if force_all:
        return True  # Forçar re-upload de todos
    return (
        "minio" in url.lower()
        or ":9000" in url
        or "r2.dev" not in url
    )


def resync(dry_run: bool = False, add_new: bool = False, force_all: bool = False, verbose: bool = False):
    """Executa a re-sincronização de anexos"""
    if not ORGANIZZE_EMAIL or not ORGANIZZE_API_KEY:
        print("❌ Configure VITE_ORGANIZZE_EMAIL e VITE_ORGANIZZE_API_KEY no .env")
        sys.exit(1)

    if not FIREBASE_USER_ID:
        print("❌ Configure FIREBASE_USER_ID no .env")
        sys.exit(1)

    if not S3_PUBLIC_URL:
        print("❌ Configure VITE_S3_PUBLIC_URL no .env")
        sys.exit(1)

    user_ref = db.collection("users").document(FIREBASE_USER_ID)

    print("📄 Buscando transações no Firestore...")
    transactions = list(user_ref.collection("transactions").stream())
    print(f"   Encontradas: {len(transactions)}")

    # Separar transações
    broken_attachments = []
    without_attachment = []
    with_attachment = []

    for doc in transactions:
        data = doc.to_dict()
        data["_id"] = doc.id

        comprovante = data.get("comprovante") or (data.get("attachments", [{}])[0] if data.get("attachments") else None)

        if comprovante:
            if force_all or is_broken_url(comprovante.get("url", "")):
                broken_attachments.append(data)
            else:
                with_attachment.append(data)
        elif not data.get("attachments"):
            without_attachment.append(data)

    print(f"   Com anexos (ok): {len(with_attachment)}")
    print(f"   Com anexos quebrados: {len(broken_attachments)}")
    print(f"   Sem anexo: {len(without_attachment)}")

    if not broken_attachments and not add_new:
        print("\n✅ Nenhum anexo para processar!")
        return

    # Determinar período
    all_txs = broken_attachments + (without_attachment if add_new else [])
    if not all_txs:
        print("\n✅ Nada para processar!")
        return

    dates = []
    for tx in all_txs:
        d = tx.get("date")
        if d:
            if hasattr(d, "strftime"):
                dates.append(d.strftime("%Y-%m-%d"))
            else:
                dates.append(str(d))
    dates = sorted(set(dates))

    start_date = dates[0] if dates else "2022-01-01"
    end_date = dates[-1] if dates else datetime.now().strftime("%Y-%m-%d")

    print(f"\n📥 Buscando transações no Organizze ({start_date} a {end_date})...")
    org_txs = organizze_request(f"/transactions?start_date={start_date}&end_date={end_date}")
    print(f"   Encontradas: {len(org_txs)}")

    org_with_attachments = [t for t in org_txs if t.get("attachments")]
    print(f"   Com anexos: {len(org_with_attachments)}")

    if not org_with_attachments:
        print("\n⚠️  Nenhuma transação com anexo encontrada no Organizze")
        return

    print("\n" + "=" * 50)
    print("🔄 PROCESSANDO ANEXOS")
    print("=" * 50)

    updated = 0
    skipped = 0
    failed = 0
    minio_lost = 0  # URLs MinIO sem match no Organizze

    # Processar anexos quebrados
    for fs_tx in broken_attachments:
        match = find_organizze_match(fs_tx, org_with_attachments)

        if match and match.get("attachments"):
            desc = fs_tx.get("description", "")[:40]
            print(f"\n📎 {desc}...")

            if dry_run:
                print("   [DRY-RUN] Seria atualizado")
                updated += 1
                continue

            att = match["attachments"][0]
            att_url = att.get("url") or att.get("file_url") or att.get("document_url")

            if not att_url:
                print("   ⚠️  Sem URL de anexo")
                skipped += 1
                continue

            downloaded = download_attachment(att_url)
            if downloaded:
                data, content_type, filename = downloaded
                try:
                    uploaded = upload_to_r2(data, content_type, filename, FIREBASE_USER_ID)
                    if uploaded:
                        user_ref.collection("transactions").document(fs_tx["_id"]).update({
                            "comprovante": uploaded
                        })
                        print("   ✅ Migrado para R2")
                        updated += 1
                        time.sleep(0.5)  # Rate limit do R2
                    else:
                        print("   ❌ Falha no upload")
                        failed += 1
                except Exception as e:
                    print(f"   ❌ Erro: {e}")
                    failed += 1
                    time.sleep(1)  # Esperar mais em caso de erro
            else:
                failed += 1
        else:
            # Sem match no Organizze
            comprovante = fs_tx.get("comprovante") or {}
            url = comprovante.get("url", "")
            has_minio = "minio" in url.lower() or ":9000" in url

            if has_minio:
                minio_lost += 1
                desc = fs_tx.get("description", "")[:50]
                fs_date = fs_tx.get("date")
                if hasattr(fs_date, "strftime"):
                    fs_date = fs_date.strftime("%Y-%m-%d")
                fs_amount = fs_tx.get("amount", 0)
                print(f"\n🔴 {desc}")
                print(f"      Data: {fs_date} | Valor: R$ {fs_amount:.2f}")
                print(f"      URL MinIO: {url[:80]}...")
                print(f"      ⚠️  SEM MATCH NO ORGANIZZE - ANEXO PERDIDO!")
            elif verbose:
                desc = fs_tx.get("description", "")[:50]
                fs_date = fs_tx.get("date")
                if hasattr(fs_date, "strftime"):
                    fs_date = fs_date.strftime("%Y-%m-%d")
                fs_amount = fs_tx.get("amount", 0)
                print(f"\n⏭️  {desc}")
                print(f"      Data: {fs_date} | Valor: R$ {fs_amount:.2f}")
            skipped += 1

    # Processar novos anexos
    if add_new:
        print("\n📎 Adicionando anexos novos...")
        for fs_tx in without_attachment:
            match = find_organizze_match(fs_tx, org_with_attachments)

            if match and match.get("attachments"):
                desc = fs_tx.get("description", "")[:40]
                print(f"\n📎 {desc}...")

                if dry_run:
                    print("   [DRY-RUN] Seria adicionado")
                    updated += 1
                    continue

                att = match["attachments"][0]
                att_url = att.get("url") or att.get("file_url") or att.get("document_url")

                if not att_url:
                    continue

                downloaded = download_attachment(att_url)
                if downloaded:
                    data, content_type, filename = downloaded
                    try:
                        uploaded = upload_to_r2(data, content_type, filename, FIREBASE_USER_ID)
                        if uploaded:
                            user_ref.collection("transactions").document(fs_tx["_id"]).update({
                                "comprovante": uploaded
                            })
                            print("   ✅ Anexo adicionado")
                            updated += 1
                            time.sleep(0.5)  # Rate limit do R2
                    except Exception as e:
                        print(f"   ❌ Erro: {e}")
                        failed += 1
                        time.sleep(1)

    # Resumo
    print("\n" + "=" * 50)
    print("📊 RESUMO")
    print("=" * 50)
    print(f"   ✅ Atualizados:    {updated}")
    print(f"   ⏭️  Ignorados:      {skipped}")
    print(f"   ❌ Falhas:         {failed}")
    if minio_lost > 0:
        print(f"   🔴 MinIO perdidos: {minio_lost} (sem match no Organizze)")
    print("=" * 50)


def clean_minio_lost(dry_run: bool = False):
    """Remove campo comprovante de transações com URL do MinIO sem match no Organizze"""
    if not FIREBASE_USER_ID:
        print("❌ Configure FIREBASE_USER_ID no .env")
        sys.exit(1)

    user_ref = db.collection("users").document(FIREBASE_USER_ID)

    print("📄 Buscando transações com URLs do MinIO...")
    transactions = list(user_ref.collection("transactions").stream())

    minio_txs = []
    for doc in transactions:
        data = doc.to_dict()
        comprovante = data.get("comprovante") or {}
        url = comprovante.get("url", "")

        if "minio" in url.lower() or ":9000" in url:
            minio_txs.append({
                "_id": doc.id,
                "description": data.get("description", ""),
                "date": data.get("date"),
                "amount": data.get("amount", 0),
                "url": url,
            })

    print(f"   Encontradas: {len(minio_txs)} transações com URL do MinIO")

    if not minio_txs:
        print("\n✅ Nenhuma transação com URL do MinIO!")
        return

    print("\n" + "=" * 50)
    print("🧹 LIMPANDO CAMPO COMPROVANTE")
    print("=" * 50)

    cleaned = 0
    for tx in minio_txs:
        desc = tx["description"][:50]
        fs_date = tx["date"]
        if hasattr(fs_date, "strftime"):
            fs_date = fs_date.strftime("%Y-%m-%d")

        print(f"\n🗑️  {desc}")
        print(f"      Data: {fs_date} | Valor: R$ {tx['amount']:.2f}")

        if dry_run:
            print("      [DRY-RUN] Seria limpo")
        else:
            user_ref.collection("transactions").document(tx["_id"]).update({
                "comprovante": firestore.DELETE_FIELD
            })
            print("      ✅ Campo comprovante removido")
            time.sleep(0.3)

        cleaned += 1

    print("\n" + "=" * 50)
    print("📊 RESUMO")
    print("=" * 50)
    print(f"   🗑️  Limpos: {cleaned}")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Re-sincronizar anexos do Organizze para R2")
    parser.add_argument("--dry-run", action="store_true", help="Apenas mostrar o que seria feito")
    parser.add_argument("--add-new", action="store_true", help="Também adicionar anexos que faltam")
    parser.add_argument("--force-all", action="store_true", help="Re-upload de TODOS anexos (corrigir content-type)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Mostrar detalhes dos ignorados")
    parser.add_argument("--clean-minio-lost", action="store_true", help="Limpar campo comprovante de URLs MinIO")

    args = parser.parse_args()

    if args.clean_minio_lost:
        clean_minio_lost(dry_run=args.dry_run)
    else:
        resync(dry_run=args.dry_run, add_new=args.add_new, force_all=args.force_all, verbose=args.verbose)


if __name__ == "__main__":
    main()
