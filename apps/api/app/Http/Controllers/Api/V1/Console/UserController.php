<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Accounts\AccountManager;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Figure 38, User Management (UT-019).
 */
class UserController extends Controller
{
    public function __construct(private readonly AccountManager $accounts)
    {
    }

    public function index(): JsonResponse
    {
        $users = User::with(['role', 'barangay'])->orderBy('email')->get()
            ->map(fn (User $user): array => $this->present($user));

        return response()->json(['users' => $users]);
    }

    /** UT-019: a new sub-admin, scoped to one barangay. */
    public function store(Request $request): JsonResponse
    {
        $user = $this->accounts->createSubAdmin($request->only(['email', 'password', 'barangayId']));

        return response()->json(['user' => $this->present($user->load(['role', 'barangay']))], 201);
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->respond($this->accounts->deactivate($user, $actor));
    }

    /** Setting a new password is also how a deactivated account is reactivated. */
    public function password(Request $request, User $user): JsonResponse
    {
        return $this->respond($this->accounts->setPassword($user, (string) $request->input('password')));
    }

    public function barangay(Request $request, User $user): JsonResponse
    {
        return $this->respond($this->accounts->reassignBarangay($user, (int) $request->input('barangayId')));
    }

    private function respond(User $user): JsonResponse
    {
        return response()->json(['user' => $this->present($user->load(['role', 'barangay']))]);
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        return [
            'id' => $user->getKey(),
            'email' => $user->email,
            'role' => $user->role?->name,
            'roleLabel' => $user->role?->label,
            'barangayId' => $user->barangay_id,
            'barangayName' => $user->barangay?->name,
            'status' => $this->accounts->isDeactivated($user) ? 'deactivated' : 'active',
            'createdAt' => $this->accounts->createdAt($user),
        ];
    }
}
