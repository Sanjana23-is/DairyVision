from __future__ import annotations

from app.seeds.breed_seed import seed_all


def main() -> None:
    count = seed_all()
    print(f"Seeded {count} breed-related records.")


if __name__ == "__main__":
    main()
