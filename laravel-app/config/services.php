<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];

    /*
    |--------------------------------------------------------------------------
    | WhatsApp Web API Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the WhatsApp Web API service. This can point to:
    | 1. A separate Node.js service running whatsapp-web.js
    | 2. A compatible WhatsApp Web API service
    | 3. Leave as default for standalone QR code generation
    |
    */

    'whatsapp' => [
        'api_url' => env('WHATSAPP_API_URL', 'http://localhost:3000'),
        'api_key' => env('WHATSAPP_API_KEY'),
        'session_path' => env('WHATSAPP_SESSION_PATH', storage_path('app/whatsapp-sessions')),
    ],

