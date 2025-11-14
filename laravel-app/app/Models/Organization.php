<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'plan',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_organizations')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function contacts()
    {
        return $this->hasMany(Contact::class);
    }

    public function channels()
    {
        return $this->hasMany(Channel::class);
    }

    public function flows()
    {
        return $this->hasMany(Flow::class);
    }
}
