# DairyVision AI Coding Standards

## 1. General Principles

- Write clear, maintainable, production-quality code.
- Use TypeScript on the frontend and Python on the backend and ML services.
- Follow SOLID principles and prefer composition over duplication.
- Keep functions small, focused, and easy to test.
- Add comments only where the intent is not obvious.

## 2. Frontend Standards

- Use React with functional components and hooks.
- Prefer TypeScript interfaces and types over any usage of `any`.
- Use feature-based folders for domain modules.
- Centralize API calls in dedicated services.
- Use shared components for repetitive UI patterns.
- Ensure all screens are responsive and accessible.

## 3. Backend Standards

- Keep route handlers thin and delegate logic to services.
- Validate inputs with Pydantic models.
- Use SQLAlchemy models consistently and keep database logic separate from business logic.
- Handle errors consistently and return structured responses.
- Prefer dependency injection patterns where appropriate.

## 4. ML Standards

- Keep training, inference, and evaluation code separated into clear modules.
- Version model artifacts and document assumptions clearly.
- Track experiments and model metadata when possible.
- Ensure inference paths are deterministic and reproducible.

## 5. Testing Standards

- Write unit and integration tests for critical flows.
- Cover authentication, permissions, core CRUD operations, and core ML inference paths.
- Prefer behavior-based tests over implementation detail tests.

## 6. Review Standards

- Each change should be reviewed for correctness, readability, and maintainability.
- Avoid large, unreviewable pull requests.
- Include migration notes for any database or API contract changes.

## 7. Security Standards

- Never hardcode secrets or credentials.
- Use environment variables for configuration.
- Validate all auth and permission paths.
- Follow secure defaults in both frontend and backend code.
