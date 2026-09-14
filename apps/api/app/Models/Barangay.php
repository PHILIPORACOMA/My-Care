<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 5: BARANGAY.
 */
class Barangay extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'city', 'region'];

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    public function triageSessions(): HasMany
    {
        return $this->hasMany(TriageSession::class);
    }
}
