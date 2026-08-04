# DairyVision AI API Contract

## 1. API Principles

The API will be RESTful, versioned, and designed around clear resource ownership. All endpoints should validate input, return structured errors, and enforce authentication and authorization.

## 2. Base URL

- Development: `http://localhost:8000/api/v1`
- Production: `https://<backend-domain>/api/v1`

## 3. Authentication Endpoints

### POST /auth/register

Creates a new user account.

Request body:

```json
{
  "email": "user@farm.com",
  "password": "StrongPassword123!",
  "full_name": "Ava Johnson"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@farm.com",
    "full_name": "Ava Johnson"
  },
  "access_token": "jwt"
}
```

### POST /auth/login

Signs in an existing user.

### POST /auth/forgot-password

Initiates password recovery.

## 4. Farm and Organization Endpoints

### GET /farms

Returns farms available to the authenticated user.

### POST /farms

Creates a new farm.

### GET /farms/{farm_id}

Returns farm details.

## 5. Herd and Cow Endpoints

### GET /farms/{farm_id}/herds

### POST /farms/{farm_id}/herds

### GET /cows/{cow_id}

### POST /cows

### PATCH /cows/{cow_id}

## 6. Daily Operations Endpoints

### GET /operations

Returns operations for a selected date range.

### POST /operations

Creates a new operation record such as milking, feeding, treatment, or breeding.

## 7. Health and Prediction Endpoints

### GET /health-alerts

Returns current health alerts for the farm.

### POST /predictions/milk-yield

Runs a milk yield prediction request for a selected cow or herd.

### GET /predictions/{prediction_id}

Returns stored predictions and metadata.

## 8. Explainability Endpoints

### GET /explainability/{prediction_id}

Returns SHAP-based explanation details.

## 9. Analytics Endpoints

### GET /analytics/dashboard

Returns summary metrics for the authenticated scope.

### GET /analytics/recommendations

Returns prioritized recommendations based on recent data.

## 10. Error Handling

All errors should use a consistent structure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request payload is invalid.",
    "details": []
  }
}
```

## 11. API Standards

- Use snake_case in JSON payloads.
- Return 200 for successful reads, 201 for successful creation, 204 for successful deletion.
- Use standard HTTP status codes.
- Include pagination for list endpoints.
