<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GstRateMaster;
use App\Models\HsnSacCode;
use App\Models\TdsTcsSection;
use App\Models\UqcMaster;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MasterConfigController extends Controller
{
    /**
     * A master value that invoices / products already use must not be deleted — it would leave those
     * documents pointing at a code or rate that no longer exists. Mark it Inactive instead.
     */
    private function refuseIfInUse(string $what, array $usages): void
    {
        $parts = [];
        foreach ($usages as $label => $count) {
            if ($count > 0) {
                $parts[] = "{$count} {$label}";
            }
        }
        abort_if($parts, 422, "This {$what} is in use ({$this->join($parts)}) and cannot be deleted. Mark it Inactive instead.");
    }

    private function join(array $parts): string
    {
        return implode(', ', $parts);
    }

    private function hsnSacUsage(HsnSacCode $r): array
    {
        return [
            'invoice line item(s)' => \DB::table('document_line_items')->where('hsn_sac', $r->code)->count(),
            'product(s)' => \Illuminate\Support\Facades\Schema::hasTable('products') ? \DB::table('products')->where('hsn_sac', $r->code)->count() : 0,
        ];
    }

    private function applyCommonFilters($q, Request $request, array $searchCols = ['code', 'description'])
    {
        if ($request->filled('status') && $request->status !== 'all') {
            $q->where('is_active', $request->status === 'active');
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($w) use ($s, $searchCols) {
                foreach ($searchCols as $i => $col) {
                    $i === 0 ? $w->where($col, 'like', "%{$s}%") : $w->orWhere($col, 'like', "%{$s}%");
                }
            });
        }
        return $q;
    }

    // ── Bulk import (Excel) ──────────────────────────────────────────────

    /**
     * Imports rows parsed from an Excel sheet into one master. Each row is validated like the
     * Add / Edit form; a row whose key (code, or rate for GST) already exists UPDATES that record,
     * otherwise a new one is created. Bad rows are reported, never silently dropped, and do not
     * stop the good ones.
     */
    public function importRows(Request $request, string $master)
    {
        abort_unless(in_array($master, ['hsn', 'sac', 'gst-rate', 'uqc', 'tds', 'tcs'], true), 404);

        $request->validate(['rows' => ['required', 'array', 'min:1', 'max:5000']]);

        $created = 0;
        $updated = 0;
        $errors = [];

        foreach ($request->input('rows') as $i => $row) {
            $line = $i + 2; // sheet row number (row 1 is the header)
            if (! is_array($row)) {
                $errors[] = ['row' => $line, 'message' => 'Invalid row.'];
                continue;
            }

            $active = ! in_array(strtolower(trim((string) ($row['status'] ?? 'active'))), ['inactive', 'no', 'false', '0'], true);
            $code = trim((string) ($row['code'] ?? ''));
            $desc = trim((string) ($row['description'] ?? ''));
            $rate = $row['rate'] ?? null;

            try {
                if ($master === 'gst-rate') {
                    abort_unless(is_numeric($rate) && $rate >= 0 && $rate <= 100, 422, 'GST rate must be a number between 0 and 100.');
                    $rec = GstRateMaster::firstOrNew(['rate' => (float) $rate]);
                    $isNew = ! $rec->exists;
                    $rec->is_active = $active;
                } elseif (in_array($master, ['hsn', 'sac'], true)) {
                    abort_if($code === '' || strlen($code) > 15, 422, 'Code is required (max 15 characters).');
                    abort_if($desc === '', 422, 'Description is required.');
                    $rec = HsnSacCode::firstOrNew(['type' => $master, 'code' => $code]);
                    $isNew = ! $rec->exists;
                    $rec->fill(['description' => $desc, 'code_length' => strlen($code), 'is_active' => $active]);
                } elseif ($master === 'uqc') {
                    abort_if($code === '' || strlen($code) > 20, 422, 'UQC code is required (max 20 characters).');
                    $rec = UqcMaster::firstOrNew(['code' => $code]);
                    $isNew = ! $rec->exists;
                    $rec->fill(['description' => $desc !== '' ? $desc : $rec->description, 'is_active' => $active]);
                } else { // tds / tcs
                    abort_if($code === '' || strlen($code) > 20, 422, 'Section is required (max 20 characters).');
                    abort_unless(is_numeric($rate) && $rate >= 0 && $rate <= 100, 422, 'Rate must be a number between 0 and 100.');
                    abort_if($desc === '', 422, 'Description is required.');
                    $rec = TdsTcsSection::firstOrNew(['type' => $master, 'code' => $code]);
                    $isNew = ! $rec->exists;
                    $rec->fill(['rate' => (float) $rate, 'description' => $desc, 'is_active' => $active]);
                }

                $rec->save();
                $isNew ? $created++ : $updated++;
            } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                $errors[] = ['row' => $line, 'message' => $e->getMessage()];
            }
        }

        return response()->json(['created' => $created, 'updated' => $updated, 'failed' => count($errors), 'errors' => array_slice($errors, 0, 50)]);
    }

    // ── HSN ──────────────────────────────────────────────────────────────

    public function hsnList(Request $request)
    {
        $q = $this->applyCommonFilters(
            HsnSacCode::where('type', 'hsn'), $request
        );
        return response()->json($q->orderBy('code')->paginate((int) $request->input('per_page', 10)));
    }

    public function hsnStore(Request $request)
    {
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:15', 'unique:hsn_sac_codes,code'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']        = 'hsn';
        $data['code_length'] = strlen($data['code']);
        $data['is_active']   = $data['is_active'] ?? true;
        return response()->json(HsnSacCode::create($data), 201);
    }

    public function hsnUpdate(Request $request, int $id)
    {
        $record = HsnSacCode::where('type', 'hsn')->findOrFail($id);
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:15', Rule::unique('hsn_sac_codes', 'code')->ignore($id)],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']        = 'hsn';
        $data['code_length'] = strlen($data['code']);
        $record->update($data);
        return response()->json($record);
    }

    public function hsnDestroy(int $id)
    {
        $rec = HsnSacCode::where('type', 'hsn')->findOrFail($id);
        $this->refuseIfInUse('HSN code', $this->hsnSacUsage($rec));
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── SAC ──────────────────────────────────────────────────────────────

    public function sacList(Request $request)
    {
        $q = $this->applyCommonFilters(
            HsnSacCode::where('type', 'sac'), $request
        );
        return response()->json($q->orderBy('code')->paginate((int) $request->input('per_page', 10)));
    }

    public function sacStore(Request $request)
    {
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:15', 'unique:hsn_sac_codes,code'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']        = 'sac';
        $data['code_length'] = strlen($data['code']);
        $data['is_active']   = $data['is_active'] ?? true;
        return response()->json(HsnSacCode::create($data), 201);
    }

    public function sacUpdate(Request $request, int $id)
    {
        $record = HsnSacCode::where('type', 'sac')->findOrFail($id);
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:15', Rule::unique('hsn_sac_codes', 'code')->ignore($id)],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']        = 'sac';
        $data['code_length'] = strlen($data['code']);
        $record->update($data);
        return response()->json($record);
    }

    public function sacDestroy(int $id)
    {
        $rec = HsnSacCode::where('type', 'sac')->findOrFail($id);
        $this->refuseIfInUse('SAC code', $this->hsnSacUsage($rec));
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── GST Rate ─────────────────────────────────────────────────────────

    public function gstRateList(Request $request)
    {
        $q = GstRateMaster::query();
        if ($request->filled('status') && $request->status !== 'all') {
            $q->where('is_active', $request->status === 'active');
        }
        if ($request->filled('search')) {
            $q->where('rate', 'like', '%' . $request->search . '%');
        }
        return response()->json($q->orderBy('rate')->paginate((int) $request->input('per_page', 10)));
    }

    public function gstRateStore(Request $request)
    {
        $data = $request->validate([
            'rate'      => ['required', 'numeric', 'min:0', 'max:100', 'unique:gst_rate_masters,rate'],
            'is_active' => ['boolean'],
        ]);
        $data['is_active'] = $data['is_active'] ?? true;
        return response()->json(GstRateMaster::create($data), 201);
    }

    public function gstRateUpdate(Request $request, int $id)
    {
        $record = GstRateMaster::findOrFail($id);
        $data = $request->validate([
            'rate'      => ['required', 'numeric', 'min:0', 'max:100', Rule::unique('gst_rate_masters', 'rate')->ignore($id)],
            'is_active' => ['boolean'],
        ]);
        $record->update($data);
        return response()->json($record);
    }

    public function gstRateDestroy(int $id)
    {
        $rec = GstRateMaster::findOrFail($id);
        $this->refuseIfInUse('GST rate', [
            'invoice line item(s)' => \DB::table('document_line_items')->where('gst_rate', $rec->rate)->count(),
            'product(s)' => \Illuminate\Support\Facades\Schema::hasTable('products') ? \DB::table('products')->where('gst_rate', $rec->rate)->count() : 0,
        ]);
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── UQC ──────────────────────────────────────────────────────────────

    public function uqcList(Request $request)
    {
        $q = $this->applyCommonFilters(UqcMaster::query(), $request);
        return response()->json($q->orderBy('code')->paginate((int) $request->input('per_page', 10)));
    }

    public function uqcStore(Request $request)
    {
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20', 'unique:uqc_masters,code'],
            'description' => ['nullable', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['is_active'] = $data['is_active'] ?? true;
        return response()->json(UqcMaster::create($data), 201);
    }

    public function uqcUpdate(Request $request, int $id)
    {
        $record = UqcMaster::findOrFail($id);
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20', Rule::unique('uqc_masters', 'code')->ignore($id)],
            'description' => ['nullable', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $record->update($data);
        return response()->json($record);
    }

    public function uqcDestroy(int $id)
    {
        $rec = UqcMaster::findOrFail($id);
        $this->refuseIfInUse('UQC', [
            'invoice line item(s)' => \DB::table('document_line_items')->where('unit', $rec->code)->count(),
            'product(s)' => \Illuminate\Support\Facades\Schema::hasTable('products') ? \DB::table('products')->where('unit', $rec->code)->count() : 0,
        ]);
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── TDS ──────────────────────────────────────────────────────────────

    public function tdsList(Request $request)
    {
        $q = TdsTcsSection::where('type', 'tds');
        $q = $this->applyCommonFilters($q, $request, ['code', 'description']);
        return response()->json($q->orderBy('sort_order')->orderBy('code')->paginate((int) $request->input('per_page', 10)));
    }

    public function tdsStore(Request $request)
    {
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']      = 'tds';
        $data['is_active'] = $data['is_active'] ?? true;
        return response()->json(TdsTcsSection::create($data), 201);
    }

    public function tdsUpdate(Request $request, int $id)
    {
        $record = TdsTcsSection::where('type', 'tds')->findOrFail($id);
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type'] = 'tds';
        $record->update($data);
        return response()->json($record);
    }

    public function tdsDestroy(int $id)
    {
        $rec = TdsTcsSection::where('type', 'tds')->findOrFail($id);
        $this->refuseIfInUse('TDS section', ['document(s)' => \DB::table('commercial_documents')->where('tds_tcs_section_id', $rec->id)->count()]);
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── TCS ──────────────────────────────────────────────────────────────

    public function tcsList(Request $request)
    {
        $q = TdsTcsSection::where('type', 'tcs');
        $q = $this->applyCommonFilters($q, $request, ['code', 'description']);
        return response()->json($q->orderBy('sort_order')->orderBy('code')->paginate((int) $request->input('per_page', 10)));
    }

    public function tcsStore(Request $request)
    {
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type']      = 'tcs';
        $data['is_active'] = $data['is_active'] ?? true;
        return response()->json(TdsTcsSection::create($data), 201);
    }

    public function tcsUpdate(Request $request, int $id)
    {
        $record = TdsTcsSection::where('type', 'tcs')->findOrFail($id);
        $data = $request->validate([
            'code'        => ['required', 'string', 'max:20'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'description' => ['required', 'string'],
            'is_active'   => ['boolean'],
        ]);
        $data['type'] = 'tcs';
        $record->update($data);
        return response()->json($record);
    }

    public function tcsDestroy(int $id)
    {
        $rec = TdsTcsSection::where('type', 'tcs')->findOrFail($id);
        $this->refuseIfInUse('TCS section', ['document(s)' => \DB::table('commercial_documents')->where('tds_tcs_section_id', $rec->id)->count()]);
        $rec->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Legacy (kept for backward compat) ────────────────────────────────

    public function hsnSacList(Request $request)
    {
        $q = HsnSacCode::query();
        if ($request->filled('type')) $q->where('type', $request->type);
        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(fn($w) => $w->where('code', 'like', "%{$s}%")->orWhere('description', 'like', "%{$s}%"));
        }
        return response()->json($q->orderBy('code')->paginate((int) $request->input('per_page', 20)));
    }

    public function hsnSacStore(Request $request)
    {
        $data = $request->validate([
            'type'        => ['required', Rule::in(['hsn', 'sac'])],
            'code'        => ['required', 'string', 'max:15', 'unique:hsn_sac_codes,code'],
            'description' => ['required', 'string'],
        ]);
        $data['code_length'] = strlen($data['code']);
        return response()->json(HsnSacCode::create($data), 201);
    }

    public function hsnSacUpdate(Request $request, int $id)
    {
        $record = HsnSacCode::findOrFail($id);
        $data = $request->validate([
            'type'        => ['required', Rule::in(['hsn', 'sac'])],
            'code'        => ['required', 'string', 'max:15', Rule::unique('hsn_sac_codes', 'code')->ignore($id)],
            'description' => ['required', 'string'],
        ]);
        $data['code_length'] = strlen($data['code']);
        $record->update($data);
        return response()->json($record);
    }

    public function hsnSacDestroy(int $id)
    {
        $rec = HsnSacCode::findOrFail($id);
        $this->refuseIfInUse('code', $this->hsnSacUsage($rec));
        $rec->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function tdsTcsList(Request $request)
    {
        $q = TdsTcsSection::query();
        if ($request->filled('type')) $q->where('type', $request->type);
        return response()->json($q->orderBy('sort_order')->orderBy('code')->paginate((int) $request->input('per_page', 20)));
    }

    public function tdsTcsStore(Request $request)
    {
        $data = $request->validate([
            'type'        => ['required', Rule::in(['tds', 'tcs'])],
            'code'        => ['required', 'string', 'max:20', 'unique:tds_tcs_sections,code'],
            'description' => ['required', 'string'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active'   => ['boolean'],
            'sort_order'  => ['integer'],
        ]);
        $data['is_active']  = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;
        return response()->json(TdsTcsSection::create($data), 201);
    }

    public function tdsTcsUpdate(Request $request, int $id)
    {
        $record = TdsTcsSection::findOrFail($id);
        $data = $request->validate([
            'type'        => ['required', Rule::in(['tds', 'tcs'])],
            'code'        => ['required', 'string', 'max:20', Rule::unique('tds_tcs_sections', 'code')->ignore($id)],
            'description' => ['required', 'string'],
            'rate'        => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active'   => ['boolean'],
            'sort_order'  => ['integer'],
        ]);
        $data['is_active']  = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;
        $record->update($data);
        return response()->json($record);
    }

    public function tdsTcsDestroy(int $id)
    {
        $rec = TdsTcsSection::findOrFail($id);
        $this->refuseIfInUse('section', ['document(s)' => \DB::table('commercial_documents')->where('tds_tcs_section_id', $rec->id)->count()]);
        $rec->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
