# backend/reset_password.py

import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_dir)

env_path = os.path.join(backend_dir, '.env')
load_dotenv(dotenv_path=env_path)

from app.db.database import SessionLocal
from app.db.models import User
from app.core.security import get_password_hash

def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"Eroare: Utilizatorul cu emailul '{email}' nu a fost găsit în baza de date.")
            return
        
        # Transformăm parola în hash-ul sigur bcrypt
        hashed_password = get_password_hash(new_password)
        
        # Actualizăm parola în baza de date
        user.password = hashed_password
        db.commit()
        
        print(f"Succes! Parola pentru '{email}' a fost schimbată.")
        
    except Exception as e:
        print(f"A apărut o eroare: {e}")
    finally:
        # Ne asigurăm că închidem conexiunea
        db.close()

if __name__ == "__main__":
    print("=== Resetare Parolă ContaFlow ===")
    target_email = input("Introdu email-ul contului: ")
    new_pass = input("Introdu noua parolă: ")
    
    reset_password(target_email, new_pass)