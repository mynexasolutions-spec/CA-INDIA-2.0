<?php

namespace App\Services;

use App\Models\ClientAmendmentRequest;
use App\Models\ClientOtherRequest;
use App\Models\ClientProfile;
use App\Models\NotificationItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * The Admin "Request" module's single view over what clients actually raise from the Client Portal:
 *
 *   Other Requests form  (client_other_requests)      -> Profile Update / Document Change /
 *                                                        Bank Details / Invoice Setting / Other
 *   Invoice Amendment    (client_amendment_requests)  -> Invoice Amendment
 *
 * Both are shown with one set of fields and ONE status vocabulary: Pending / Completed / Rejected.
 * Completing / rejecting writes back the status each source (and the Client Portal) already
 * understands: Other -> "resolved" / "rejected", Amendment -> "approved" / "rejected", with the
 * rejection reason stored in admin_remarks, which the client sees on their request.
 */
class ClientRequestFeed
{
    public const TYPES = ['profile_update', 'document_change', 'bank_details', 'invoice_setting', 'invoice_amendment', 'other'];

    private const OTHER_TYPE_MAP = [
        'Profile Update'   => 'profile_update',
        'Document Change'  => 'document_change',
        'Bank Details'     => 'bank_details',
        'Invoice Settings' => 'invoice_setting',
        'Others'           => 'other',
    ];

    private const TYPE_LABELS = [
        'profile_update'    => 'Profile Update',
        'document_change'   => 'Document Change',
        'bank_details'      => 'Bank Details',
        'invoice_setting'   => 'Invoice Setting',
        'invoice_amendment' => 'Invoice Amendment',
        'other'             => 'Other Request',
    ];

    private const DOC_LABELS = [
        'tax_invoice' => 'Tax Invoice', 'bill_of_supply' => 'Bill of Supply', 'debit_note' => 'Debit Note',
        'credit_note' => 'Credit Note', 'quotation' => 'Quotation', 'delivery_challan' => 'Delivery Challan',
    ];

    /** Whatever a source stores -> pending | completed | rejected. */
    public static function normaliseStatus(?string $raw): string
    {
        return match (strtolower((string) $raw)) {
            'resolved', 'completed', 'approved', 'amendment_created' => 'completed',
            'rejected' => 'rejected',
            default => 'pending',
        };
    }

    // ── reading ─────────────────────────────────────────────────────────────────────

    /** Every request of one client, newest first, in the shape the Admin screens use. */
    public static function forClient(ClientProfile $client): Collection
    {
        $who = ($client->business_name ?? $client->client_name ?? 'Client').' (Client)';

        $other = ClientOtherRequest::where('client_profile_id', $client->id)->get()
            ->map(fn (ClientOtherRequest $r) => self::fromOther($r, $who));
        $amend = ClientAmendmentRequest::where('client_profile_id', $client->id)->get()
            ->map(fn (ClientAmendmentRequest $r) => self::fromAmendment($r, $who));

        return $other->concat($amend)
            ->sortByDesc(fn ($r) => $r['submitted_at'].'|'.str_pad((string) $r['sort_id'], 10, '0', STR_PAD_LEFT))
            ->values();
    }

    /** @return array<int, array{total:int,pending:int,completed:int,rejected:int}> keyed by client_profile_id */
    public static function countsByClient(): array
    {
        $counts = [];
        $add = function ($rows) use (&$counts) {
            foreach ($rows as $r) {
                $c = &$counts[$r->client_profile_id];
                $c ??= ['total' => 0, 'pending' => 0, 'completed' => 0, 'rejected' => 0];
                $n = (int) $r->n;
                $c['total'] += $n;
                $c[self::normaliseStatus($r->status)] += $n;
                unset($c);
            }
        };

        $add(ClientOtherRequest::selectRaw('client_profile_id, status, COUNT(*) as n')->groupBy('client_profile_id', 'status')->get());
        $add(ClientAmendmentRequest::selectRaw('client_profile_id, status, COUNT(*) as n')->groupBy('client_profile_id', 'status')->get());

        return $counts;
    }

    /**
     * Total / pending / completed / rejected per category, optionally limited to requests created
     * between two dates (the Admin Dashboard's selected period).
     *
     * @return array<string, array{total:int,pending:int,completed:int,rejected:int}>
     */
    public static function countsByType(?string $from = null, ?string $to = null): array
    {
        $out = [];
        foreach (self::TYPES as $t) {
            $out[$t] = ['total' => 0, 'pending' => 0, 'completed' => 0, 'rejected' => 0];
        }
        $add = function (string $type, string $rawStatus, int $n) use (&$out) {
            $out[$type]['total'] += $n;
            $out[$type][self::normaliseStatus($rawStatus)] += $n;
        };
        $range = fn ($q) => $q
            ->when($from, fn ($w) => $w->whereDate('created_at', '>=', $from))
            ->when($to, fn ($w) => $w->whereDate('created_at', '<=', $to));

        foreach ($range(ClientOtherRequest::query())->selectRaw('request_type, status, COUNT(*) as n')->groupBy('request_type', 'status')->get() as $r) {
            $add(self::OTHER_TYPE_MAP[$r->request_type] ?? 'other', $r->status, (int) $r->n);
        }
        foreach ($range(ClientAmendmentRequest::query())->selectRaw('status, COUNT(*) as n')->groupBy('status')->get() as $r) {
            $add('invoice_amendment', $r->status, (int) $r->n);
        }

        return $out;
    }

    private static function fromOther(ClientOtherRequest $r, string $who): array
    {
        $type = self::OTHER_TYPE_MAP[$r->request_type] ?? 'other';
        $status = self::normaliseStatus($r->status);

        $description = $r->request_details;
        if ($r->document_type || $r->document_number) {
            $doc = trim((self::DOC_LABELS[$r->document_type] ?? '').' '.$r->document_number);
            $description = "Document: {$doc}\n".$description;
        }

        $attachments = [];
        if ($r->attachment_path) {
            $disk = Storage::disk('local');
            $ext = strtolower(pathinfo($r->attachment_path, PATHINFO_EXTENSION));
            $attachments[] = [
                'name' => 'Attachment.'.($ext ?: 'file'),
                'type' => $ext,
                'size' => $disk->exists($r->attachment_path) ? self::humanSize($disk->size($r->attachment_path)) : null,
                'url'  => "/api/admin/requests/other-{$r->id}/attachment",
            ];
        }

        return [
            'id'               => "other-{$r->id}",
            'sort_id'          => $r->id,
            'request_id'       => $r->requestId(),
            'request_type'     => $type,
            'type_label'       => self::TYPE_LABELS[$type],
            'subject'          => $r->subject,
            'description'      => $description,
            'update_details'   => [],
            'attachments'      => $attachments,
            'client_remarks'   => $r->please_specify,
            'status'           => $status,
            'rejection_reason' => $status === 'rejected' ? $r->admin_remarks : null,
            'submitted_at'     => $r->created_at?->toIso8601String(),
            'submitted_on'     => $r->created_at?->format('d M Y, h:i A'),
            'requested_by'     => $who,
        ];
    }

    private static function fromAmendment(ClientAmendmentRequest $r, string $who): array
    {
        $status = self::normaliseStatus($r->status);
        $docLabel = self::DOC_LABELS[$r->document_type] ?? ucfirst(str_replace('_', ' ', (string) $r->document_type));

        // The existing facts about the document being amended, plus what the client asked for.
        $details = array_values(array_filter([
            ['field_name' => 'Document', 'existing_value' => trim("{$docLabel} {$r->bill_number}"), 'requested_value' => '—'],
            $r->document_date ? ['field_name' => 'Document Date', 'existing_value' => $r->document_date->format('d M Y'), 'requested_value' => '—'] : null,
            $r->customer_name ? ['field_name' => 'Customer', 'existing_value' => trim($r->customer_name.($r->gstin ? " ({$r->gstin})" : '')), 'requested_value' => '—'] : null,
            $r->original_amount !== null ? ['field_name' => 'Invoice Amount', 'existing_value' => '₹ '.number_format((float) $r->original_amount, 2), 'requested_value' => '—'] : null,
            ['field_name' => 'Amendment Required', 'existing_value' => '—', 'requested_value' => $r->reason],
        ]));

        return [
            'id'               => "amendment-{$r->id}",
            'sort_id'          => $r->id,
            'request_id'       => 'AMD-'.($r->created_at?->format('Y') ?? date('Y')).'-'.str_pad((string) $r->id, 3, '0', STR_PAD_LEFT),
            'request_type'     => 'invoice_amendment',
            'type_label'       => self::TYPE_LABELS['invoice_amendment'],
            'subject'          => "Amendment – {$docLabel} {$r->bill_number}",
            'description'      => $r->reason,
            'update_details'   => $details,
            'attachments'      => [],
            'client_remarks'   => $r->remarks,
            'status'           => $status,
            'rejection_reason' => $status === 'rejected' ? $r->admin_remarks : null,
            'submitted_at'     => $r->created_at?->toIso8601String(),
            'submitted_on'     => $r->created_at?->format('d M Y, h:i A'),
            'requested_by'     => $who,
        ];
    }

    private static function humanSize(int $bytes): string
    {
        return $bytes >= 1048576 ? round($bytes / 1048576, 1).' MB' : max(1, (int) round($bytes / 1024)).' KB';
    }

    // ── acting on one request ───────────────────────────────────────────────────────

    /** @return array{0: 'other'|'amendment', 1: \Illuminate\Database\Eloquent\Model} */
    public static function find(string $key): array
    {
        abort_unless(preg_match('/^(other|amendment)-(\d+)$/', $key, $m), 404, 'Request not found.');

        $model = $m[1] === 'other'
            ? ClientOtherRequest::with('clientProfile')->findOrFail((int) $m[2])
            : ClientAmendmentRequest::with('clientProfile')->findOrFail((int) $m[2]);

        return [$m[1], $model];
    }

    public static function complete(string $key): array
    {
        [$source, $req] = self::find($key);
        abort_unless(self::normaliseStatus($req->status) === 'pending', 422, 'Only pending requests can be completed.');

        $req->update(['status' => $source === 'other' ? 'resolved' : 'approved']);
        self::notify($source, $req, 'Request Completed', 'has been completed.');

        return [$source, $req->fresh()];
    }

    public static function reject(string $key, string $reason): array
    {
        [$source, $req] = self::find($key);
        abort_unless(self::normaliseStatus($req->status) === 'pending', 422, 'Only pending requests can be rejected.');

        $req->update(['status' => 'rejected', 'admin_remarks' => trim($reason)]);
        self::notify($source, $req, 'Request Rejected', 'was rejected. Reason: '.trim($reason));

        return [$source, $req->fresh()];
    }

    public static function attachment(string $key): array
    {
        [$source, $req] = self::find($key);
        abort_unless($source === 'other' && $req->attachment_path && Storage::disk('local')->exists($req->attachment_path), 404, 'Attachment not found.');

        $ext = strtolower(pathinfo($req->attachment_path, PATHINFO_EXTENSION));

        return [$req->attachment_path, 'Attachment-'.$req->requestId().'.'.($ext ?: 'file')];
    }

    private static function notify(string $source, $req, string $title, string $tail): void
    {
        $userId = $req->clientProfile?->user_id;
        if (! $userId) {
            return;
        }

        $label = $source === 'other' ? $req->requestId() : ($req->bill_number ?: 'amendment');
        NotificationItem::create([
            'user_id' => $userId,
            'title'   => $title,
            'body'    => "Your request {$label} {$tail}",
            'type'    => 'client_request',
        ]);
    }
}
