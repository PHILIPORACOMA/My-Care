<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Ruleset\BundleAssembler;
use App\Domain\Ruleset\BundleImporter;
use App\Domain\Ruleset\RulesetLifecycle;
use App\Http\Controllers\Controller;
use App\Models\RulesetVersion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Figure 39, Triage Rule & Lexicon Configuration (UT-007–UT-011).
 *
 * Thin by design: every state change goes through Domain/Ruleset/RulesetLifecycle,
 * which is the only code that moves RULESET_VERSION.status.
 */
class RulesetVersionController extends Controller
{
    public function __construct(
        private readonly RulesetLifecycle $lifecycle,
        private readonly BundleAssembler $assembler,
        private readonly BundleImporter $importer,
    ) {
    }

    public function index(): JsonResponse
    {
        $versions = RulesetVersion::with('publishedBy')
            ->withCount(['rules', 'lexiconTerms', 'severityThresholds', 'clarificationQuestions', 'healthTips'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (RulesetVersion $v): array => $this->present($v) + [
                'counts' => [
                    'rules' => $v->rules_count,
                    'lexiconTerms' => $v->lexicon_terms_count,
                    'severityThresholds' => $v->severity_thresholds_count,
                    'clarificationQuestions' => $v->clarification_questions_count,
                    'healthTips' => $v->health_tips_count,
                ],
            ]);

        return response()->json(['versions' => $versions]);
    }

    public function show(RulesetVersion $version): JsonResponse
    {
        return response()->json([
            'version' => $this->present($version->load('publishedBy')),
            'content' => $this->assembler->content($version),
        ]);
    }

    /** New draft: empty, or copied from `baseVersionId`. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['baseVersionId' => ['nullable', 'integer', 'exists:ruleset_versions,id']]);

        $base = isset($data['baseVersionId']) ? RulesetVersion::findOrFail($data['baseVersionId']) : null;

        return $this->created($this->lifecycle->createDraft($base));
    }

    /** Import a whole RulesetBundle JSON as a draft (e.g. packages/ruleset v1). */
    public function import(Request $request): JsonResponse
    {
        $data = $request->validate(['bundle' => ['required', 'array']]);

        return $this->created($this->importer->import($data['bundle']));
    }

    /** UT-010: every save writes a new version. */
    public function saveContent(Request $request, RulesetVersion $version): JsonResponse
    {
        $data = $request->validate(['content' => ['required', 'array']]);

        return $this->created($this->lifecycle->saveDraft($version, $data['content']));
    }

    public function submit(RulesetVersion $version): JsonResponse
    {
        return $this->ok($this->lifecycle->submitForReview($version));
    }

    public function returnToDraft(RulesetVersion $version): JsonResponse
    {
        return $this->ok($this->lifecycle->returnToDraft($version));
    }

    /** UT-011. */
    public function publish(Request $request, RulesetVersion $version): JsonResponse
    {
        $data = $request->validate(['clinicalReviewConfirmed' => ['required', 'boolean']]);

        /** @var User $user */
        $user = $request->user();

        return $this->ok($this->lifecycle->publish($version, $user, (bool) $data['clinicalReviewConfirmed']));
    }

    /** UT-011: restore a previously published version as a new publication. */
    public function rollback(Request $request, RulesetVersion $version): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->created($this->lifecycle->rollbackTo($version, $user));
    }

    /** @return array<string, mixed> */
    private function present(RulesetVersion $version): array
    {
        return [
            'id' => $version->getKey(),
            'label' => $version->label,
            'status' => $version->status,
            'publishedAt' => $version->published_at?->toIso8601String(),
            'publishedBy' => $version->publishedBy?->email,
        ];
    }

    private function created(RulesetVersion $version): JsonResponse
    {
        return response()->json(['version' => $this->present($version->load('publishedBy'))], 201);
    }

    private function ok(RulesetVersion $version): JsonResponse
    {
        return response()->json(['version' => $this->present($version->load('publishedBy'))]);
    }
}
