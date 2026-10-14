<?php

namespace App\Console\Commands;

use App\Models\CommercialDocument;
use App\Models\DocumentEditRequest;
use App\Models\DocumentLineItem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class PurgeTrashedCommercialDocumentsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'billing:purge-trashed-documents';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Permanently purge soft-deleted commercial documents older than the first day of the previous calendar month';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        // Purge rule: eligible when deleted_at < first day of the PREVIOUS calendar month relative to now.
        // E.g., deleted 15 Apr -> purged from 1 Jun (when cutoff is 1 May); not purged on 31 May (when cutoff is 1 Apr).
        $cutoff = now()->startOfMonth()->subMonth();

        $this->info("Purging soft-deleted documents with deleted_at < {$cutoff->toDateTimeString()}...");

        $trashed = CommercialDocument::onlyTrashed()
            ->where('deleted_at', '<', $cutoff)
            ->get();

        $count = 0;
        foreach ($trashed as $doc) {
            DB::transaction(function () use ($doc) {
                // Remove line items
                DocumentLineItem::where('commercial_document_id', $doc->id)->delete();

                // Remove document edit requests if table exists
                if (Schema::hasTable('document_edit_requests')) {
                    DocumentEditRequest::where('commercial_document_id', $doc->id)->delete();
                }

                // Remove PDF file if stored
                if ($doc->pdf_path && Storage::disk('public')->exists($doc->pdf_path)) {
                    Storage::disk('public')->delete($doc->pdf_path);
                }

                // Force delete the document record
                $doc->forceDelete();
            });

            $count++;
        }

        $this->info("Successfully purged {$count} commercial documents.");

        return Command::SUCCESS;
    }
}
