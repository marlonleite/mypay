#!/usr/bin/env python3
"""Verifica dados no Firestore"""

import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent
load_dotenv(project_root / ".env")

import firebase_admin
from firebase_admin import credentials, firestore

FIREBASE_USER_ID = os.getenv("FIREBASE_USER_ID")
firebase_creds = os.getenv("FIREBASE_CREDENTIALS")

# Inicializar Firebase
if firebase_creds and (firebase_creds.startswith("/") or firebase_creds.startswith(".")):
    cred = credentials.Certificate(firebase_creds)
else:
    print("❌ FIREBASE_CREDENTIALS não configurado")
    exit(1)

firebase_admin.initialize_app(cred)
db = firestore.client()

print(f"🔍 Verificando dados para usuário: {FIREBASE_USER_ID}\n")

user_ref = db.collection("users").document(FIREBASE_USER_ID)

# Verificar transações de janeiro 2026
print("📅 Transações de Janeiro 2026:")
start = datetime(2026, 1, 1)
end = datetime(2026, 1, 31, 23, 59, 59)

jan_transactions = user_ref.collection("transactions").where("date", ">=", start).where("date", "<=", end).get()
print(f"   Encontradas: {len(jan_transactions)}")

for doc in jan_transactions[:5]:
    data = doc.to_dict()
    print(f"   - {data.get('description')}: R${data.get('amount')} ({data.get('date')})")

print("\n📅 Todas as datas únicas nas transações:")
all_transactions = user_ref.collection("transactions").limit(100).get()
dates = set()
for doc in all_transactions:
    data = doc.to_dict()
    d = data.get('date')
    if d:
        if hasattr(d, 'year'):
            dates.add(f"{d.year}-{d.month:02d}")
        else:
            dates.add(str(d)[:7])

for d in sorted(dates):
    print(f"   {d}")
