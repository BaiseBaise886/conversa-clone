<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    protected $fillable = [
        'organization_id',
        'name',
        'phone',
        'email',
        'instagram_username',
        'channel_type',
        'tags',
        'custom_fields',
        'last_message_at',
        'last_message_preview',
        'unread_count',
        'archived_at',
        'pinned',
        'muted',
    ];

    protected $casts = [
        'tags' => 'array',
        'custom_fields' => 'array',
        'last_message_at' => 'datetime',
        'archived_at' => 'datetime',
        'pinned' => 'boolean',
        'muted' => 'boolean',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
