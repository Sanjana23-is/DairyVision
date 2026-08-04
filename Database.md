# DairyVision AI Database Design

## 1. Database Platform

The production database will be PostgreSQL hosted on Supabase. The schema should be designed for relational integrity, clear ownership boundaries, and future analytics growth.

## 2. Core Design Principles

- Use UUID primary keys for distributed-friendly identity.
- Enforce foreign keys for ownership and relationships.
- Separate tenant or organization context from user identity.
- Maintain audit fields for tracking changes.

## 3. Core Tables

### users

Stores authenticated user identities and profile metadata.

Columns:

- id: UUID, PK
- email: VARCHAR, unique
- full_name: VARCHAR
- avatar_url: TEXT, nullable
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

### farms

Represents a dairy operation or business unit.

Columns:

- id: UUID, PK
- name: VARCHAR
- owner_user_id: UUID, FK -> users.id
- location: VARCHAR, nullable
- created_at: TIMESTAMP

### herds

Represents one or more animal groups under a farm.

Columns:

- id: UUID, PK
- farm_id: UUID, FK -> farms.id
- name: VARCHAR
- description: TEXT, nullable

### cows

Represents an individual cow profile.

Columns:

- id: UUID, PK
- herd_id: UUID, FK -> herds.id
- tag_id: VARCHAR, unique
- breed: VARCHAR, nullable
- birth_date: DATE, nullable
- sex: VARCHAR
- status: VARCHAR
- created_at: TIMESTAMP

### operations

Represents day-to-day management events.

Columns:

- id: UUID, PK
- farm_id: UUID, FK -> farms.id
- cow_id: UUID, FK -> cows.id, nullable
- operation_type: VARCHAR
- performed_at: TIMESTAMP
- notes: TEXT, nullable
- created_by: UUID, FK -> users.id

### health_alerts

Tracks generated or manually created alerts.

Columns:

- id: UUID, PK
- cow_id: UUID, FK -> cows.id
- severity: VARCHAR
- title: VARCHAR
- description: TEXT
- status: VARCHAR
- created_at: TIMESTAMP

### predictions

Stores model outputs for yield or health assessments.

Columns:

- id: UUID, PK
- cow_id: UUID, FK -> cows.id, nullable
- farm_id: UUID, FK -> farms.id
- model_name: VARCHAR
- prediction_type: VARCHAR
- score: FLOAT
- metadata: JSONB
- created_at: TIMESTAMP

### recommendations

Stores operator-facing suggestions.

Columns:

- id: UUID, PK
- farm_id: UUID, FK -> farms.id
- priority: VARCHAR
- title: VARCHAR
- description: TEXT
- created_at: TIMESTAMP

## 4. Indexing Strategy

- Index farm_id and herd_id lookups.
- Index operations by performed_at and farm_id.
- Index alerts by severity and status.
- Use JSONB for flexible metadata in prediction records.

## 5. Migration Strategy

- Use Alembic for schema evolution.
- Keep migrations small and reversible.
- Review schema changes with the team before merging.

## 6. Data Governance Notes

- Avoid storing secrets in application tables.
- Keep personally identifiable data limited to what is strictly needed.
- Introduce retention policies for operational and analytical records over time.
