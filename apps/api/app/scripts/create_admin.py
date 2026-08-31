"""Create a Voysse team account for the internal admin panel.

There's no self-registration for admin accounts on purpose -- run this once
per teammate who needs access to /admin.

Usage (inside the api container):
    docker compose --env-file .env.docker exec api python -m app.scripts.create_admin
"""

import getpass
import sys

from sqlalchemy import select

from ..database import SessionLocal
from ..models import AdminUser
from ..security import hash_password


def main() -> None:
    db = SessionLocal()
    try:
        name = input("Name: ").strip()
        email = input("Email: ").strip().lower()
        if not name or not email:
            print("Name and email are required.", file=sys.stderr)
            raise SystemExit(1)
        if db.scalar(select(AdminUser).where(AdminUser.email == email)):
            print(f"An admin with email {email} already exists.", file=sys.stderr)
            raise SystemExit(1)
        password = getpass.getpass("Password (min 8 characters): ")
        if len(password) < 8:
            print("Password must be at least 8 characters.", file=sys.stderr)
            raise SystemExit(1)
        if getpass.getpass("Confirm password: ") != password:
            print("Passwords did not match.", file=sys.stderr)
            raise SystemExit(1)

        admin = AdminUser(name=name, email=email, password_hash=hash_password(password))
        db.add(admin)
        db.commit()
        print(f"Created admin account for {email}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
