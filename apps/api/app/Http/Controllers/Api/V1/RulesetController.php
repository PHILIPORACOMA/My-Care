<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Ruleset\BundleAssembler;
use App\Http\Controllers\Controller;
use App\Models\RulesetVersion;
use Illuminate\Http\JsonResponse;

/**
 * UT-013: a device checks for rule/lexicon updates and caches the latest
 * published version locally.
 */
class RulesetController extends Controller
{
    public function __construct(private readonly BundleAssembler $assembler)
    {
    }

    /**
     * Serve the current published ruleset bundle.
     *
     * Only `published` versions are ever served. A draft is unreviewed clinical
     * content by definition, and a handset that cached one would be triaging
     * patients against rules nobody has signed off — so the status filter here
     * is a safety control, not a convenience.
     */
    public function current(): JsonResponse
    {
        $version = RulesetVersion::where('status', 'published')
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->first();

        if ($version === null) {
            // 503 rather than 404: the resource is not missing, the server is
            // not yet in a state to serve it. A device should retry later
            // rather than treat this as "no ruleset exists".
            return response()->json([
                'message' => 'No published ruleset version is available.',
            ], 503);
        }

        return response()->json([
            'versionLabel' => $version->label,
            'publishedAt' => $version->published_at?->toIso8601String(),
            'bundle' => $this->assembler->assemble($version),
        ]);
    }
}
