<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientChangeRequest;
use App\Models\ClientProfile;
use App\Services\Billing\DocumentNumberingSettings;
use Illuminate\Http\Request;

class ChangeRequestController extends Controller
{
    private function profile(Request $request): ClientProfile
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 404, 'Client profile not found');

        return $profile;
    }

    private function approvedSnapshot(ClientProfile $profile): array
    {
        $text = [];
        foreach (ClientChangeRequest::snapshotFields() as $field) {
            $text[$field] = ClientChangeRequest::liveValue($profile, $field);
        }

        return [
            'text' => $text,
            // Auto / Manual is controlled by the admin only — the client just needs to know it.
            'numbering_types' => DocumentNumberingSettings::numberingTypes($profile),
            'layout_id' => (int) ($profile->default_layout_id ?: 1),
            'colour_scheme' => (string) ($profile->default_colour_scheme ?: 'slate_blue'),
            'logo_path' => $profile->logo_path,
            'signature_path' => $profile->signature_path,
            'seal_path' => $profile->seal_path,
            'qr_code_path' => $profile->qr_code_path,
        ];
    }

    private function serializeRequest(?ClientChangeRequest $req): ?array
    {
        if (! $req) {
            return null;
        }

        return [
            'id' => $req->id,
            'section' => $req->section,
            'status' => $req->status,
            'payload' => $req->payload ?? [],
            'logo_path' => $req->logo_path,
            'signature_path' => $req->signature_path,
            'seal_path' => $req->seal_path,
            'qr_code_path' => $req->qr_code_path,
            'admin_note' => $req->admin_note,
            'reviewed_at' => $req->reviewed_at,
            'created_at' => $req->created_at,
            'updated_at' => $req->updated_at,
        ];
    }

    /**
     * Every Settings tab (branding / bank / invoice_settings / numbering) tracks its own
     * independent pending + last-reviewed request, so one tab can show "Pending Approval"
     * while another simultaneously shows "Approved" — not one shared status for the whole page.
     */
    public function current(Request $request)
    {
        $profile = $this->profile($request);

        $sections = [];
        foreach (ClientChangeRequest::SECTIONS as $section) {
            $pending = ClientChangeRequest::where('client_profile_id', $profile->id)
                ->where('section', $section)
                ->where('status', ClientChangeRequest::STATUS_PENDING)
                ->latest('id')
                ->first();
            $last = ClientChangeRequest::where('client_profile_id', $profile->id)
                ->where('section', $section)
                ->whereIn('status', [ClientChangeRequest::STATUS_APPROVED, ClientChangeRequest::STATUS_REJECTED])
                ->latest('id')
                ->first();

            $draft = ClientChangeRequest::where('client_profile_id', $profile->id)
                ->where('section', $section)
                ->where('status', ClientChangeRequest::STATUS_DRAFT)
                ->latest('id')
                ->first();

            $sections[$section] = [
                'pending' => $this->serializeRequest($pending),
                'draft' => $this->serializeRequest($draft),
                'last_reviewed' => $this->serializeRequest($last),
            ];
        }

        return response()->json([
            'approved' => $this->approvedSnapshot($profile),
            'sections' => $sections,
        ]);
    }

    /** Full change-request history across all sections, for the "View Request History" page. */
    public function history(Request $request)
    {
        $profile = $this->profile($request);
        $q = ClientChangeRequest::where('client_profile_id', $profile->id)
            ->where('status', '!=', ClientChangeRequest::STATUS_DRAFT)
            ->latest('id');

        if ($request->filled('section') && in_array($request->section, ClientChangeRequest::SECTIONS, true)) {
            $q->where('section', $request->section);
        }

        $page = $q->paginate(20);
        $page->getCollection()->transform(fn ($req) => $this->serializeRequest($req));

        return response()->json($page);
    }

    /** Separator / next number / prefix position / status for every document type. */
    private function numberingRules(): array
    {
        $rules = [];
        foreach (array_keys(DocumentNumberingSettings::DOCS) as $key) {
            // GST document numbers may only contain letters, digits, "-" and "/".
            $rules["{$key}_separator"] = ['nullable', 'string', 'in:-,/'];
            $rules["{$key}_next_number"] = ['nullable', 'regex:/^\d{1,9}$/'];
            $rules["{$key}_prefix_position"] = ['nullable', 'string', 'in:first,last'];
            $rules["{$key}_status"] = ['nullable', 'string', 'in:active,inactive'];
        }

        return $rules;
    }

    private function validationRules(): array
    {
        return array_merge($this->numberingRules(), [
            'bank_name' => 'nullable|string|max:120',
            'bank_branch' => 'nullable|string|max:120',
            'account_holder_name' => 'nullable|string|max:120',
            'bank_account' => 'nullable|string|max:60',
            'bank_ifsc' => 'nullable|string|max:20',
            'swift_code' => 'nullable|string|max:30',
            'account_type' => 'nullable|string|max:40',
            'upi_id' => 'nullable|string|max:120',
            'signatory_name' => 'nullable|string|max:120',
            'invoice_prefix' => 'nullable|string|max:40',
            'bill_of_supply_prefix' => 'nullable|string|max:40',
            'credit_note_prefix' => 'nullable|string|max:40',
            'debit_note_prefix' => 'nullable|string|max:40',
            'quotation_prefix' => 'nullable|string|max:40',
            'delivery_challan_prefix' => 'nullable|string|max:40',
            'layout_id' => 'nullable|integer|in:1,2,3,4',
            'colour_scheme' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(\App\Models\ClientDocumentSetting::COLOUR_SCHEMES))],
            'terms_conditions' => 'nullable|string',
        ]);
    }

    public function store(Request $request)
    {
        $profile = $this->profile($request);

        $data = $request->validate(array_merge($this->validationRules(), [
            'section' => 'required|string|in:'.implode(',', ClientChangeRequest::SECTIONS),
        ]));
        $section = $data['section'];
        unset($data['section']);

        // Only accept fields that actually belong to this section — a bank-tab submit can't
        // sneak in a numbering-prefix change, even if the client sent one.
        $payload = [];
        $unchanged = [];
        foreach ($data as $field => $value) {
            if (ClientChangeRequest::sectionOf($field) === $section) {
                // The form posts every field of the tab; numbering fields equal to what is already
                // live aren't a change, so they stay out of the request (and out of the admin's diff).
                if (DocumentNumberingSettings::isField($field)) {
                    if ($value === null || DocumentNumberingSettings::isUnchanged($profile, $field, $value)) {
                        $unchanged[] = $field;
                        continue;
                    }
                }
                $payload[$field] = $value;
            }
        }

        $pending = ClientChangeRequest::where('client_profile_id', $profile->id)
            ->where('section', $section)
            ->where('status', ClientChangeRequest::STATUS_PENDING)
            ->latest('id')
            ->first();
        $draft = ClientChangeRequest::where('client_profile_id', $profile->id)
            ->where('section', $section)
            ->where('status', ClientChangeRequest::STATUS_DRAFT)
            ->latest('id')
            ->first();

        // A field changed back to its live value drops out of a still-pending request too.
        $withoutUnchanged = fn (array $p) => array_diff_key($p, array_flip($unchanged));

        if ($section === ClientChangeRequest::SECTION_NUMBERING) {
            $effective = array_merge($withoutUnchanged($pending?->payload ?? []), $payload);
            abort_if(! $effective, 422, 'No changes to submit.');
            // Duplicate / already-used-number guard (also re-run when the admin approves).
            DocumentNumberingSettings::assertValid($profile, $effective);
        }

        if ($draft && $pending) {
            // Files staged after a submit belong to the same open request: fold them in.
            foreach (ClientChangeRequest::ASSET_FIELDS as $column) {
                if ($draft->{$column}) {
                    $pending->{$column} = $draft->{$column};
                }
            }
            $pending->save();
            $draft->delete();
            $draft = null;
        }

        if ($pending) {
            $merged = array_merge($withoutUnchanged($pending->payload ?? []), $payload);
            $pending->update([
                'payload' => $merged,
                'submitted_by' => $request->user()->id,
            ]);
        } elseif ($draft) {
            // The client pressed "Submit for Approval": the staged files + these fields become ONE request.
            $draft->update([
                'payload' => $payload,
                'submitted_by' => $request->user()->id,
                'status' => ClientChangeRequest::STATUS_PENDING,
            ]);
            $pending = $draft;
        } else {
            $pending = ClientChangeRequest::create([
                'client_profile_id' => $profile->id,
                'section' => $section,
                'submitted_by' => $request->user()->id,
                'status' => ClientChangeRequest::STATUS_PENDING,
                'payload' => $payload,
            ]);
        }

        return response()->json([
            'message' => 'Change request submitted for approval',
            'pending' => $this->serializeRequest($pending->fresh()),
            'approved' => $this->approvedSnapshot($profile),
        ], $pending->wasRecentlyCreated ? 201 : 200);
    }

    /** The client's own layout preview (real renderer, demo data). Nothing is stored. */
    public function layoutPreview(Request $request, \App\Services\DocumentTemplate\LayoutPreviewRenderer $renderer)
    {
        $profile = $this->profile($request);

        $data = $request->validate([
            'layout_id' => 'required|integer|in:1,2,3,4',
            'colour_scheme' => ['required', 'string', \Illuminate\Validation\Rule::in(array_keys(\App\Models\ClientDocumentSetting::COLOUR_SCHEMES))],
        ]);

        try {
            $pdf = $this->cachedLayoutPreview($renderer, $profile, (int) $data['layout_id'], (string) $data['colour_scheme']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Client layout preview failed for {$profile->id}: ".$e->getMessage());

            return response()->json(['message' => 'Preview unavailable. Please try again.'], 503);
        }

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="layout-preview.pdf"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /**
     * Rendering the preview PDF costs ~1.5 s (dompdf), so identical requests are served from a small file cache.
     * The key covers everything the render depends on: the whole profile row (branding, company name, any edit bumps
     * it), the layout, the colour and today's date (the demo document shows the current date). Files expire after a
     * day, and expired ones are swept whenever a new preview is written.
     */
    private function cachedLayoutPreview(\App\Services\DocumentTemplate\LayoutPreviewRenderer $renderer, $profile, int $layoutId, string $colour): string
    {
        $disk = \Illuminate\Support\Facades\Storage::disk('local');
        // 'v2': bump whenever the rendered output changes for the same inputs (e.g. the footer), so old files are not reused.
        $key = md5(json_encode([$profile->getAttributes(), $layoutId, $colour, now()->toDateString(), 'v13']));
        $path = "layout-preview-cache/{$key}.pdf";

        if ($disk->exists($path) && $disk->lastModified($path) > now()->subDay()->getTimestamp()) {
            return $disk->get($path);
        }

        // The preview shows the "Generated by …" footer, as on the approved form.
        $pdf = $renderer->render($profile, $layoutId, $colour, 'tax_invoice', true, true);

        try {
            foreach ($disk->files('layout-preview-cache') as $old) {
                if ($disk->lastModified($old) < now()->subDay()->getTimestamp()) {
                    $disk->delete($old);
                }
            }
            $disk->put($path, $pdf);
        } catch (\Throwable $e) {
            // The cache is an optimisation only — a write failure must never break the preview.
            \Illuminate\Support\Facades\Log::notice('Layout preview cache write failed: '.$e->getMessage());
        }

        return $pdf;
    }

    public function uploadAsset(Request $request, string $field)
    {
        abort_unless(array_key_exists($field, ClientChangeRequest::ASSET_FIELDS), 404);

        $column = ClientChangeRequest::ASSET_FIELDS[$field];
        $max = $field === 'logo' ? 4096 : 2048;
        $request->validate([$field => "required|image|max:{$max}"]);

        $profile = $this->profile($request);
        $pending = ClientChangeRequest::where('client_profile_id', $profile->id)
            ->where('section', ClientChangeRequest::SECTION_BRANDING)
            ->whereIn('status', [ClientChangeRequest::STATUS_PENDING, ClientChangeRequest::STATUS_DRAFT])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
            ->latest('id')
            ->first();

        if (! $pending) {
            // Nothing is sent to the admin until the client presses "Submit for Approval".
            $pending = ClientChangeRequest::create([
                'client_profile_id' => $profile->id,
                'section' => ClientChangeRequest::SECTION_BRANDING,
                'submitted_by' => $request->user()->id,
                'status' => ClientChangeRequest::STATUS_DRAFT,
                'payload' => [],
            ]);
        }

        $path = $request->file($field)->store("change-requests/{$pending->id}", 'public');
        $pending->update([
            $column => $path,
            'submitted_by' => $request->user()->id,
        ]);

        return response()->json([
            $column => $path,
            'url' => '/storage/'.$path,
            'pending' => $this->serializeRequest($pending->fresh()),
        ]);
    }
}
