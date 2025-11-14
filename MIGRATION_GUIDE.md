# Migration Guide: Node.js to Laravel

This document explains the conversion from the Node.js/React stack to pure Laravel/PHP.

## What Changed?

### Architecture Changes

| Component | Before (Node.js) | After (Laravel) |
|-----------|------------------|-----------------|
| **Backend** | Express.js (Node.js) | Laravel 11 (PHP 8.3+) |
| **Frontend** | React + Vite | Blade Templates |
| **Build Process** | npm/webpack/vite | None required |
| **API Auth** | JWT (custom) | Laravel Sanctum |
| **Web Auth** | JWT + localStorage | Laravel Sessions |
| **ORM** | Raw SQL | Eloquent ORM |
| **Queue** | Bull (Redis) | Laravel Queue |
| **WebSocket** | Socket.io | Laravel Broadcasting |
| **File Storage** | Multer + fs | Laravel Storage |
| **Config** | dotenv | Laravel .env |

### Directory Structure Comparison

#### Before (Node.js)
```
conversa-clone/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── services/
│   │   └── middleware/
│   ├── migrations/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── store.js
│   ├── package.json
│   └── vite.config.js
└── package.json
```

#### After (Laravel)
```
conversa-clone/
├── laravel-app/
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── Api/      # Was backend/src/routes/
│   │   │   │   └── Web/      # New for Blade views
│   │   ├── Models/           # New Eloquent models
│   │   └── Services/         # Was backend/src/services/
│   ├── database/
│   │   └── migrations/       # Was backend/migrations/
│   ├── resources/
│   │   └── views/            # Was frontend/src/components/
│   ├── routes/
│   │   ├── api.php           # Was backend/src/routes/
│   │   └── web.php           # New for web interface
│   └── composer.json         # Replaces package.json
└── [old dirs remain for reference]
```

## Code Conversion Examples

### 1. Authentication

#### Before (Node.js - Express)
```javascript
// backend/src/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user.rows[0] || !await bcrypt.compare(password, user.rows[0].password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET);
    res.json({ token, user: user.rows[0] });
});
```

#### After (Laravel - PHP)
```php
// app/Http/Controllers/Api/AuthController.php
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

public function login(Request $request)
{
    $credentials = $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    if (Auth::attempt($credentials)) {
        $user = Auth::user();
        $token = $user->createToken('auth-token')->plainTextToken;
        return response()->json(['token' => $token, 'user' => $user]);
    }

    return response()->json(['error' => 'Invalid credentials'], 401);
}
```

### 2. Database Queries

#### Before (Node.js - Raw SQL)
```javascript
// backend/src/services/contact.service.js
const getContacts = async (organizationId) => {
    const result = await pool.query(
        'SELECT * FROM contacts WHERE organization_id = $1 ORDER BY created_at DESC',
        [organizationId]
    );
    return result.rows;
};
```

#### After (Laravel - Eloquent)
```php
// app/Models/Contact.php
public static function getForOrganization($organizationId)
{
    return self::where('organization_id', $organizationId)
        ->orderBy('created_at', 'desc')
        ->get();
}

// Or in controller:
Contact::where('organization_id', $organizationId)
    ->latest()
    ->get();
```

### 3. Frontend Components

#### Before (React)
```jsx
// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../store';

function Dashboard() {
    const [stats, setStats] = useState({});
    
    useEffect(() => {
        api.get('/stats').then(res => setStats(res.data));
    }, []);
    
    return (
        <div className="dashboard">
            <h1>Dashboard</h1>
            <div className="stats">
                <div>Contacts: {stats.contacts}</div>
                <div>Messages: {stats.messages}</div>
            </div>
        </div>
    );
}
```

#### After (Blade Template)
```php
<!-- resources/views/dashboard/index.blade.php -->
@extends('layouts.app')

@section('content')
<div class="dashboard">
    <h1>Dashboard</h1>
    <div class="stats">
        <div>Contacts: {{ $stats['contacts'] }}</div>
        <div>Messages: {{ $stats['messages'] }}</div>
    </div>
</div>
@endsection
```

```php
// app/Http/Controllers/Web/DashboardController.php
public function index()
{
    $stats = [
        'contacts' => Contact::count(),
        'messages' => Message::count(),
    ];
    
    return view('dashboard.index', compact('stats'));
}
```

### 4. Middleware

#### Before (Node.js)
```javascript
// backend/src/middleware/auth.js
export const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
```

#### After (Laravel)
```php
// Built-in with Sanctum - just use middleware
Route::middleware('auth:sanctum')->group(function () {
    // Protected routes here
});

// In controller, access user:
$user = $request->user();
$organizationId = $user->organizations()->first()->id;
```

### 5. Queue Jobs

#### Before (Node.js - Bull)
```javascript
// backend/src/services/queue.service.js
import Queue from 'bull';

const messageQueue = new Queue('messages', process.env.REDIS_URL);

messageQueue.process(async (job) => {
    const { contactId, message } = job.data;
    await whatsappService.sendMessage(contactId, message);
});

// Dispatch job
messageQueue.add({ contactId: 123, message: 'Hello' });
```

#### After (Laravel - Queue)
```php
// app/Jobs/SendMessage.php
namespace App\Jobs;

class SendMessage implements ShouldQueue
{
    public function __construct(
        public Contact $contact,
        public string $message
    ) {}
    
    public function handle(WhatsAppService $whatsapp)
    {
        $whatsapp->sendMessage($this->contact, $this->message);
    }
}

// Dispatch job
SendMessage::dispatch($contact, 'Hello');
```

## Benefits of Laravel Version

### 1. No Build Process
- **Before**: Required `npm install`, `npm run build`, webpack/vite compilation
- **After**: Just `composer install`, no build step needed
- **Result**: Faster deployments, simpler CI/CD

### 2. Better Type Safety
- **Before**: JavaScript (dynamic typing)
- **After**: PHP 8.3+ with type hints and strict types
- **Result**: Fewer runtime errors

### 3. Built-in Features
- **Before**: Needed custom solutions for auth, queue, storage, etc.
- **After**: Laravel provides tested, battle-hardened solutions
- **Result**: Less code to maintain

### 4. Ecosystem
- **Before**: Multiple npm packages with various quality levels
- **After**: Curated Laravel packages with consistent APIs
- **Result**: More reliable dependencies

### 5. Performance
- **Before**: Node.js single-threaded event loop
- **After**: PHP-FPM with process pool
- **Result**: Better handling of blocking operations

## Migration Checklist

If you're migrating from the old Node.js version:

### Data Migration

- [ ] Export data from PostgreSQL (Node.js version)
- [ ] Transform password_hash column to password
- [ ] Import into Laravel database structure
- [ ] Verify relationships (user_organizations, etc.)

### Feature Parity

- [ ] User authentication ✅
- [ ] Organization management ✅
- [ ] Contact CRUD ✅
- [ ] Channel management ✅
- [ ] Message handling ✅
- [ ] Flow automation ⚠️ (Structure ready)
- [ ] WhatsApp integration ⚠️ (Needs PHP library)
- [ ] AI integration ⚠️ (Needs HTTP client)
- [ ] Analytics ⚠️ (Structure ready)
- [ ] Media library ⚠️ (Structure ready)

### Configuration

- [ ] Copy `.env` values from Node.js version
- [ ] Update database credentials
- [ ] Update Redis configuration
- [ ] Add API keys (Gemini, OpenAI)
- [ ] Configure storage paths

### Testing

- [ ] Test user registration
- [ ] Test login (web + API)
- [ ] Test contact creation
- [ ] Test channel connection
- [ ] Test message sending
- [ ] Test API endpoints
- [ ] Test queue workers
- [ ] Test file uploads

## Common Issues & Solutions

### Issue: "Class not found"
**Solution**: Run `composer dump-autoload`

### Issue: "Table not found"
**Solution**: Run `php artisan migrate`

### Issue: "Permission denied"
**Solution**: `chmod -R 775 storage bootstrap/cache`

### Issue: "SQLSTATE connection refused"
**Solution**: Verify PostgreSQL is running and credentials in .env are correct

### Issue: "Session not working"
**Solution**: Check that `SESSION_DRIVER=database` and run `php artisan migrate`

## Performance Considerations

### Optimization Tips

1. **Enable OPcache** in production
```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
```

2. **Cache Config** in production
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

3. **Use Queue Workers**
```bash
php artisan queue:work redis --tries=3
```

4. **Database Indexes**
- All foreign keys are indexed
- Search fields have GIN indexes
- Created_at fields are indexed for sorting

## Support & Resources

- **Laravel Documentation**: https://laravel.com/docs
- **Laravel Sanctum**: https://laravel.com/docs/sanctum
- **Eloquent ORM**: https://laravel.com/docs/eloquent
- **Blade Templates**: https://laravel.com/docs/blade
- **Laravel Queues**: https://laravel.com/docs/queues

## Contributing

When contributing to the Laravel version:

1. Follow PSR-12 coding standards
2. Use type hints for all methods
3. Write Eloquent relationships instead of raw queries
4. Use Laravel's built-in features (don't reinvent the wheel)
5. Add comments for complex business logic
6. Write tests for new features

## Conclusion

The Laravel version provides:
- ✅ Simpler deployment (no build process)
- ✅ Better type safety (PHP 8.3+)
- ✅ More maintainable codebase
- ✅ Battle-tested ecosystem
- ✅ Built-in security features
- ✅ Better documentation

All while maintaining the same core functionality as the Node.js version.
