# Food Inventory System API Documentation

## Base URL
```
Development: http://localhost:3000/api
Production: https://yourdomain.com/api
```

## Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "details": {...}
}
```

## Authentication
Currently no authentication required (add JWT/session auth later)

## Endpoints

### Orders

#### GET /api/orders
Get all orders with statistics
- Query params:
  - `status`: Filter by status (waiting_review, approved, rejected)
  - `limit`: Limit results

#### POST /api/orders
Create a new order
```json
{
  "orderNumber": "ORD-2024-001",
  "companyName": "Restaurant Name",
  "companyCode": "REST001",
  "source": "email",
  "items": [
    {
      "name": "Tomatoes",
      "quantity": "50 lbs",
      "unit_price": 2.50,
      "total": 125.00
    }
  ]
}
```

#### GET /api/orders/:id
Get single order by ID

#### PUT /api/orders/:id
Update order

#### DELETE /api/orders/:id
Delete order

#### POST /api/orders/:id/approve
Approve an order

#### POST /api/orders/:id/reject
Reject an order with reason
```json
{
  "reason": "Incorrect items"
}
```

### Recipes

#### GET /api/recipes
Get all recipes
- Query params:
  - `category`: Filter by category
  - `search`: Search by name

#### POST /api/recipes
Create new recipe
```json
{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza",
  "prep_time_minutes": 30,
  "cook_time_minutes": 15,
  "servings": 4,
  "difficulty_level": "medium"
}
```

#### GET /api/recipes/:id
Get single recipe with ingredients and steps

#### PUT /api/recipes/:id
Update recipe

#### DELETE /api/recipes/:id
Delete recipe

#### POST /api/recipes/:id/ingredients
Add ingredient to recipe
```json
{
  "ingredient_id": "ing-123",
  "ingredient_name": "Tomato Sauce",
  "quantity": 200,
  "unit": "grams"
}
```

#### POST /api/recipes/:id/steps
Add step to recipe
```json
{
  "instruction": "Roll out the dough",
  "step_number": 1,
  "duration_minutes": 5
}
```

### Inventory

#### GET /api/inventory
Get all inventory items with stats
- Query params:
  - `category`: Filter by category
  - `lowStock`: true to show only low stock items

#### POST /api/inventory
Create inventory item
```json
{
  "name": "Tomatoes",
  "category": "Produce",
  "quantity": 100,
  "unit": "lbs",
  "minimum_quantity": 20,
  "supplier": "Local Farm",
  "cost_per_unit": 2.50,
  "location": "Walk-in Cooler A"
}
```

#### GET /api/inventory/:id
Get single inventory item

#### PUT /api/inventory/:id
Update inventory item

#### PATCH /api/inventory/:id
Update inventory quantity
```json
{
  "quantity": 75,
  "reason": "Used for orders"
}
```

### Health

#### GET /api/health
Health check endpoint - returns system status

## Error Codes

- `400` - Bad Request (invalid data)
- `404` - Resource not found
- `500` - Internal server error

## Rate Limiting
No rate limiting currently implemented (add for production)

## Webhooks
Future implementation for order notifications

## Testing
Use tools like Postman or curl:
```bash
# Get all orders
curl http://localhost:3000/api/orders

# Create order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"TEST-001", ...}'
```