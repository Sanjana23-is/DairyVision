# DairyVision AI Layered Architecture Rules

## Layer Responsibilities

### frontend/

Contains only React, TypeScript, Tailwind CSS, and UI-related code.

- Components
- Pages
- Routing
- State management for UI concerns
- API client wrappers for calling backend endpoints

### backend/

Contains only FastAPI, SQLAlchemy, authentication, REST APIs, and business logic.

- API routes
- Authentication and authorization
- Service layer
- SQLAlchemy models and database access
- Business rules
- Integration with the ML engine through service calls

### ml_engine/

Contains only machine learning logic.

- Feature engineering
- Training and inference pipelines
- Model definitions
- Prediction services
- Weather processing
- Explainability logic
- Digital twin logic

### docs/

Contains only architecture and documentation artifacts.

- Architecture documents
- Design notes
- Planning documents
- Database schema documentation

## Architectural Constraints

- React code must never be placed inside backend.
- Python ML code must never be placed inside frontend.
- React must never access the database directly.
- All frontend-to-backend communication must happen through REST APIs.
- The backend is the only layer allowed to communicate with both the database and the ML engine.
- If a requested feature belongs to another layer, the work must stop and be explained before implementation proceeds.

## Design Principles

- Preserve clean architecture and maintainability over convenience.
- Keep each layer focused on its responsibility.
- Use interfaces and service boundaries to prevent coupling.
- Favor explicit contracts over implicit integrations.
