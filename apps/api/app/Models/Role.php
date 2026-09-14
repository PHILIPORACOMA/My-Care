<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 24: ROLE.
 */
class Role extends Model
{
    /** The Data Dictionary defines no created_at/updated_at on any entity. */
    public $timestamps = false;

    protected $fillable = ['name', 'label', 'description'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
