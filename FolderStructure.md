# DairyVision AI Folder Structure

## 1. Repository Layout

```text
DairyVisionAI/
├── docs/                          # Planning and design documents
├── frontend/                      # React + TypeScript application
│   ├── src/
│   │   ├── app/                   # App shell, providers, routes
│   │   ├── components/            # Shared UI components
│   │   ├── features/              # Feature-based modules
│   │   │   ├── auth/
│   │   │   ├── farms/
│   │   │   ├── herds/
│   │   │   ├── cows/
│   │   │   ├── operations/
│   │   │   ├── analytics/
│   │   │   └── ml/
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── services/              # API client and service adapters
│   │   ├── types/                 # Shared TypeScript types
│   │   └── styles/                # Tailwind and global styles
│   ├── public/
│   └── package.json
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── api/                   # Route definitions
│   │   ├── core/                  # Config, security, middleware
│   │   ├── db/                    # Database setup and migrations
│   │   ├── models/                # SQLAlchemy models
│   │   ├── schemas/               # Pydantic schemas
│   │   ├── services/              # Business logic
│   │   ├── repositories/          # Data access layer
│   │   └── tests/
│   ├── alembic/
│   └── requirements.txt
├── ml/                            # Python ML pipeline and model artifacts
│   ├── data/
│   ├── models/
│   ├── notebooks/
│   └── scripts/
├── scripts/                       # Deployment and operational helpers
├── tests/                         # Cross-cutting tests
└── README.md
```

## 2. Frontend Organization Principles

- Feature-based folders should group related UI, hooks, and services together.
- Shared UI should live under components/.
- API access should be centralized in services/.

## 3. Backend Organization Principles

- Keep routers thin and delegate work to services.
- Place shared infrastructure in core/.
- Use repositories or data-access helpers for database logic.

## 4. ML Organization Principles

- Keep training code, inference code, and model artifacts separated.
- Avoid mixing ML scripts directly into the API layer.
