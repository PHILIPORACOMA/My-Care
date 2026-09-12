<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sync\BatchIngestor;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSyncBatchRequest;
use App\Models\Device;
use Illuminate\Http\JsonResponse;

/**
 * UT-012 (aggregate sync) and UT-015 (deduplication).
 */
class SyncBatchController extends Controller
{
    public function __construct(private readonly BatchIngestor $ingestor)
    {
    }

    /**
     * Accept one uploaded batch of de-identified session records.
     *
     * Status codes are the contract here:
     *
     *   201  the batch was stored for the first time
     *   200  this batch has already been stored; the original result is returned
     *
     * **Never 409.** A duplicate is not a conflict — it is a device doing
     * exactly what an offline-first client is supposed to do when it cannot
     * tell whether its upload or merely its acknowledgement was lost. Answering
     * with an error would invite a third attempt and, worse, tempt a client
     * author into "fixing" it by dropping data.
     */
    public function store(StoreSyncBatchRequest $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        ['result' => $result, 'replayed' => $replayed] =
            $this->ingestor->ingest($device, $request->validated());

        return response()->json($result, $replayed ? 200 : 201);
    }
}
